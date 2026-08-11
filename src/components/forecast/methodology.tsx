import { COPY } from "@/config/copy";
import { Card } from "@/components/ui/card";

const M = COPY.methodology;

/** The "How this page works" panel, rendered from the centralized copy. All
 *  static, so it paints before the fetches land; `updatedLine` is the one
 *  fetched value and trails the last sentence, where its arrival shifts nothing. */
export function Methodology({ updatedLine }: { updatedLine?: string }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-base font-bold">{M.title}</h2>

      <div className="grid max-w-[82ch] gap-3 text-sm leading-relaxed text-ink-soft">
        {M.sections.map((s) => (
          <div key={s.lead}>
            <strong className="text-ink">{s.lead}</strong> {s.body}
          </div>
        ))}

        <div className="border-t border-line-soft pt-3.5">
          <h3 className="mb-2.5 text-sm font-bold text-ink">{M.roughSeas.title}</h3>
          <div className="grid gap-2.5">
            {M.roughSeas.points.map((p) => (
              <div key={p}>{p}</div>
            ))}
          </div>
        </div>

        <div className="border-t border-line-soft pt-3.5">
          <h3 className="mb-2.5 text-sm font-bold text-ink">{M.sources.title}</h3>
          <div className="grid gap-2.5">
            <div>{M.sources.intro}</div>
            {M.sources.contacts.map((c) => (
              <div key={c.label}>
                {c.label}:{" "}
                <span className="font-semibold tabular-nums text-ink">{c.value}</span>
                {c.note ? <span className="text-ink-mute"> {c.note}</span> : null}
              </div>
            ))}
            <div className="flex flex-wrap gap-3.5 font-semibold">
              {M.sources.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener">
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="text-[13px] text-ink-mute">
          {M.disclaimer}
          {updatedLine ? ` ${M.lastUpdatedPrefix} ${updatedLine}.` : null}
        </div>
      </div>
    </Card>
  );
}
