/**
 * Live Blue Grotto status, cross-checked across sources.
 *
 * Each source is read independently and reports open / closed / unknown. The
 * combined status uses only definitive reads; if two sources disagree we flag a
 * conflict and prefer the primary. Running this server-side means no dependency
 * on public CORS proxies (the delivered design leaned on r.jina.ai / allorigins).
 *
 * capri.net exposes a reliable text banner and is the primary. bluegrotto.tours
 * shows a JS/image traffic-light with no server-readable state word, so it is a
 * best-effort secondary that usually returns "unknown". That is harmless, and it will
 * start contributing automatically if that ever becomes parseable.
 */

import type { GrottoLive } from "@/lib/forecast/types";

type Status = "open" | "closed" | "unknown";

const FETCH_TIMEOUT_MS = 12_000;
const REVALIDATE_S = 1800; // 30 min
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
 * capri.net (primary). The live "closed" banner is authoritative when present.
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

/**
 * bluegrotto.tours (best-effort secondary). The live light is JS/image
 * rendered with no reliable server-readable state, so we are deliberately
 * conservative: only a *status-scoped* image (its src/alt names a light /
 * status / open-closed context) is trusted for its colour. A stray green or
 * red asset elsewhere on the page must not manufacture a status, otherwise it
 * could override the primary or fake a "sources disagree".
 */
export function parseBlueGrotto(html: string): Status {
  const STATUS_SCOPED = /status|semaforo|traffic|light|open|clos/;
  for (const tag of html.match(/<img[^>]+>/gi) ?? []) {
    const attrs = tag.toLowerCase();
    if (!STATUS_SCOPED.test(attrs)) continue;
    if (/green/.test(attrs)) return "open";
    if (/red/.test(attrs)) return "closed";
  }
  return "unknown";
}

const SOURCES: GrottoSource[] = [
  { name: "capri.net", url: "https://www.capri.net/en/e/la-grotta-azzurra", parse: parseCapriNet },
  { name: "bluegrotto.tours", url: "https://www.bluegrotto.tours/opening-times/", parse: parseBlueGrotto },
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
