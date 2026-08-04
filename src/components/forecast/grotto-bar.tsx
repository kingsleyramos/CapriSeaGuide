import { COPY } from "@/config/copy";
import type { GrottoLive } from "@/lib/forecast/types";
import { Card } from "@/components/ui/card";
import { GrottoChip } from "@/components/ui/chip";

/** Live Blue Grotto open/closed bar. `live` is null until the status loads. */
export function GrottoBar({ live }: { live: GrottoLive | null }) {
  const c = COPY.grottoBar;
  const status = live?.status ?? "unknown";
  const line = live?.conflict ? c.disagreement : c.statusLine[status];

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3.5 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <GrottoChip status={status}>{c.statusLabel[status]}</GrottoChip>
        <div>
          <div className="text-[15px] font-bold text-ink">{c.title}</div>
          <div className="text-[13px] font-medium text-ink-soft">{line}</div>
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
