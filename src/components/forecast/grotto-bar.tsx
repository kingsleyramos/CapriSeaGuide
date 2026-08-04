import { COPY } from "@/config/copy";
import type { GrottoView } from "@/lib/forecast/grotto-view";
import { Card } from "@/components/ui/card";
import { GrottoChip } from "@/components/ui/chip";

/** Live Blue Grotto status bar. `view` is resolved from capri.net's verdict
 *  plus the Capri-local opening-hours clock (see buildGrottoView). */
export function GrottoBar({ view }: { view: GrottoView }) {
  const c = COPY.grottoBar;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3.5 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <GrottoChip tone={view.tone}>{view.label}</GrottoChip>
        <div>
          <div className="text-[15px] font-bold text-ink">{c.title}</div>
          <div className="text-[13px] font-medium text-ink-soft">{view.line}</div>
        </div>
      </div>
      <a
        href={COPY.grottoReportUrl}
        target="_blank"
        rel="noopener"
        className="whitespace-nowrap text-[13px] font-semibold"
      >
        {c.viewReport}
      </a>
    </Card>
  );
}
