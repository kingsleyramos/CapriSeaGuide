"use client";

import { ChevronDown } from "lucide-react";
import { COPY } from "@/config/copy";
import { buildHistoryView, type HistoryDayView } from "@/lib/forecast/grotto-view";
import { cn } from "@/lib/utils";
import { useGrottoHistory } from "@/hooks/use-grotto-history";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const GUTTER = "w-[76px] shrink-0";

/** Bar segment fill: solid for reported, pale for estimated, muted for none. */
function segClass(status: "open" | "closed" | "none", estimated: boolean): string {
  if (status === "none") return "bg-surface-muted";
  if (estimated) return status === "open" ? "bg-pill-low-bg" : "bg-pill-high-bg";
  return status === "open" ? "bg-grotto-open" : "bg-grotto-closed";
}
function statusPillClass(status: "open" | "closed", estimated: boolean): string {
  if (estimated) {
    return status === "open" ? "bg-pill-low-bg text-pill-low-fg" : "bg-pill-high-bg text-pill-high-fg";
  }
  return status === "open" ? "bg-grotto-open text-white" : "bg-grotto-closed text-white";
}
const colHidden = (mobile: boolean) => (mobile ? "" : "hidden md:table-cell");

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block size-3 rounded-sm", className)} />
      {label}
    </span>
  );
}

function DayRow({ view }: { view: HistoryDayView }) {
  const s = COPY.grottoHistory;
  const estimated = view.kind === "estimated";

  return (
    <Collapsible className="border-b border-line-soft last:border-b-0">
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink">
        <span className={cn(GUTTER, "text-[13px] font-semibold text-ink")}>{view.label}</span>
        <span className="flex h-[22px] flex-1 gap-px overflow-hidden rounded-md border border-line bg-surface">
          {view.bar.map((seg, i) => (
            <span
              key={i}
              className={cn("flex items-center overflow-hidden", segClass(seg.status, estimated))}
              style={{ width: `${seg.widthPct}%` }}
            >
              {seg.status === "none" ? (
                <span className="w-full text-center text-[11px] text-ink-mute">{s.legend.none}</span>
              ) : seg.label ? (
                <span className="whitespace-nowrap pl-1.5 text-[11px] font-medium text-white">
                  {seg.label}
                </span>
              ) : null}
            </span>
          ))}
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink-mute transition-transform duration-150 group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="overflow-x-auto bg-surface-muted px-4 py-3">
          {view.rows.length ? (
            <table className="w-full border-collapse whitespace-nowrap text-[13px]">
              <thead>
                <tr className="text-left text-[11px] text-ink-mute">
                  <th className="py-1 pr-4 font-medium">{s.timeHeading}</th>
                  <th className="py-1 pr-4 font-medium">{s.statusHeading}</th>
                  {s.columns.map((c) => (
                    <th key={c.key} className={cn("py-1 pr-4 font-medium", colHidden(c.mobile))}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-ink">
                {view.rows.map((row, ri) => (
                  <tr key={ri} className="border-t border-line">
                    <td className="py-2 pr-4 tabular-nums text-ink-soft">{row.time}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          statusPillClass(row.statusKind, estimated),
                        )}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    {s.columns.map((c) => (
                      <td key={c.key} className={cn("py-2 pr-4 tabular-nums", colHidden(c.mobile))}>
                        {row.cells[c.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-[13px] text-ink-soft">{s.noReport}</div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** "Blue Grotto, last 7 days": a timeline bar per day, tap a row for the grid. */
export function GrottoHistory() {
  const data = useGrottoHistory();
  const s = COPY.grottoHistory;
  const view = data ? buildHistoryView(data) : null;

  return (
    <Card className="overflow-hidden">
      <div className="px-4 pb-2 pt-4">
        <div className="text-base font-bold text-ink">{s.title}</div>
        <div className="text-[13px] font-medium text-ink-soft">{s.subtitle}</div>
        <div className="mt-1 text-xs text-ink-mute">{s.modelNote}</div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-soft">
          <LegendSwatch className="bg-grotto-open" label={s.legend.open} />
          <LegendSwatch className="bg-grotto-closed" label={s.legend.closed} />
          <LegendSwatch className="bg-pill-low-bg" label={s.legend.estimated} />
          <LegendSwatch className="border border-dashed border-line bg-surface-muted" label={s.legend.none} />
        </div>
      </div>

      {view && view.days.length ? (
        <>
          <div className="flex items-center gap-3 px-4 pb-2">
            <span className={GUTTER} />
            <div className="relative h-4 flex-1">
              {view.axis.map((a, i) => (
                <span
                  key={a.label}
                  className="absolute top-0 text-[11px] tabular-nums text-ink-mute"
                  style={{
                    left: `${a.pct}%`,
                    transform:
                      i === 0
                        ? "none"
                        : i === view.axis.length - 1
                          ? "translateX(-100%)"
                          : "translateX(-50%)",
                  }}
                >
                  {a.label}
                </span>
              ))}
            </div>
            <span className="size-4 shrink-0" />
          </div>
          {view.days.map((v) => (
            <DayRow key={v.date} view={v} />
          ))}
        </>
      ) : (
        <div className="px-4 py-4 text-[13px] text-ink-soft">{s.empty}</div>
      )}
    </Card>
  );
}
