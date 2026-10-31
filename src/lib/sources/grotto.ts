/**
 * Live Blue Grotto status, cross-checked across sources.
 *
 * Each source is read independently and reports open / closed / unknown. The
 * combined status uses only definitive reads; if two sources disagree we flag a
 * conflict and prefer the primary. Running this server-side means no dependency
 * on public CORS proxies (the delivered design leaned on r.jina.ai / allorigins).
 *
 * The boatmen's own feed, behind the widget on motoscafisticapri.com, is the
 * primary. capri.net mirrors it, but replaces its banner with static text from
 * November to February and then reads "unknown".
 */

import type { GrottoLive } from "@/lib/forecast/types";

type Status = "open" | "closed" | "unknown";

const FETCH_TIMEOUT_MS = 12_000;
/** Live-bar path only; the recorder passes `fresh` to bypass it. Kept in step
 *  with the Cache-Control on /api/grotto, and no shorter -- every miss is a
 *  request to someone else's website. */
const REVALIDATE_S = 600; // 10 min
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

interface GrottoSource {
  name: string;
  url: string;
  parse: (text: string) => Status;
}

/** Collapse a page to plain lowercase text for keyword matching. */
const flatten = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();

/**
 * capri.net. The live "closed" banner is authoritative when present.
 * The "can be visited today" phrase also lives in a script template that is
 * always present, so it only means "open" when the closed banner is absent (or
 * appears after it).
 */
export function parseCapriNet(html: string): Status {
  const t = flatten(html);
  const closedAt = t.indexOf("grotto is closed at the moment");
  const openAt = t.indexOf("grotto can be visited today");
  if (closedAt >= 0 && (openAt < 0 || closedAt < openAt)) return "closed";
  if (openAt >= 0) return "open";
  return "unknown";
}

/** The boatmen's feed: `{"status":"open"|"closed","last_modify":"<epoch s>"}`. */
export function parseBoatmen(json: string): Status {
  try {
    const { status } = JSON.parse(json) as { status?: unknown };
    return status === "open" || status === "closed" ? status : "unknown";
  } catch {
    return "unknown";
  }
}

const SOURCES: GrottoSource[] = [
  { name: "motoscafisti", url: "https://salsa-api.trustedsite.net/json/Bluegrotto", parse: parseBoatmen },
  { name: "capri.net", url: "https://www.capri.net/en/e/la-grotta-azzurra", parse: parseCapriNet },
];

async function readSource(src: GrottoSource, fresh: boolean): Promise<Status> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(src.url, {
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT },
      // The recorder needs an uncached read each poll; the live bar can cache.
      ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: REVALIDATE_S } }),
    });
    if (!res.ok) return "unknown";
    return src.parse(await res.text());
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchGrottoStatus({ fresh = false } = {}): Promise<GrottoLive> {
  const results = await Promise.all(
    SOURCES.map(async (s) => ({ name: s.name, status: await readSource(s, fresh) })),
  );

  const definitive = results.filter((r) => r.status !== "unknown");
  const hasOpen = definitive.some((r) => r.status === "open");
  const hasClosed = definitive.some((r) => r.status === "closed");
  const conflict = hasOpen && hasClosed;

  // Prefer the primary source (first in SOURCES) when there's any disagreement.
  const primary = results.find((r) => r.status !== "unknown");
  const status: Status = conflict
    ? (results[0].status !== "unknown" ? results[0].status : primary!.status)
    : (primary?.status ?? "unknown");

  return { status, sources: results, conflict, checkedAt: Date.now() };
}
