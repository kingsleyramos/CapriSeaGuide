"use client";

import { ChevronDown } from "lucide-react";
import { COPY } from "@/config/copy";
import { buildHistoryView, type HistoryDayView, type HistoryGridRow } from "@/lib/forecast/grotto-view";
import { pillClass } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { useGrottoHistory } from "@/hooks/use-grotto-history";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const GUTTER = "w-[76px] shrink-0";

const barKindClass: Record<HistoryGridRow["statusKind"], string> = {
  open: "bg-grotto-open",
  closed: "bg-grotto-closed",
  modeled: "bg-surface-muted",
};

function statusPillClass(row: HistoryGridRow): string {
  if (row.statusKind === "open") return "bg-pill-low-bg text-pill-low-fg";
  if (row.statusKind === "closed") return "bg-pill-high-bg text-pill-high-fg";
  return row.tone ? pillClass[row.tone] : "bg-surface-muted text-ink-soft";
}

/** Non-mobile columns hide below the md breakpoint. */
const colHidden = (mobile: boolean) => (mobile ? "" : "hidden md:table-cell");

function DayRow({ view }: { view: HistoryDayView }) {
  const s = COPY.grottoHistory;
  return (
    <Collapsible className="border-b border-line-soft last:border-b-0">
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink">
        <span className={cn(GUTTER, "text-[13px] font-semibold text-ink")}>{view.label}</span>
        <span className="flex h-[22px] flex-1 gap-px overflow-hidden rounded-md border border-line bg-surface">
          {view.bar.map((seg, i) => (
            <span
              key={i}
              className={cn("flex items-center overflow-hidden", barKindClass[seg.kind])}
              style={{ width: `${seg.widthPct}%` }}
            >
              {seg.kind === "modeled" ? (
                <span className="w-full text-center text-[11px] text-ink-mute">modeled</span>
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
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums",
                        statusPillClass(row),
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
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** "Blue Grotto, last 7 days": a timeline bar per day, tap a row for the grid. */
export function GrottoHistory() {
  const days = useGrottoHistory();
  const s = COPY.grottoHistory;
  const views = days ? buildHistoryView(days) : [];

  return (
    <Card className="overflow-hidden">
      <div className="px-4 pb-2 pt-4">
        <div className="text-base font-bold text-ink">{s.title}</div>
        <div className="text-[13px] font-medium text-ink-soft">{s.subtitle}</div>
        <div className="mt-1 text-xs text-ink-mute">{s.modelNote}</div>
      </div>

      <div className="flex items-center gap-3 px-4 pb-2">
        <span className={GUTTER} />
        <div className="flex flex-1 justify-between text-[11px] text-ink-mute">
          {s.timeAxis.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <span className="size-4 shrink-0" />
      </div>

      {views.length ? (
        views.map((v) => <DayRow key={v.date} view={v} />)
      ) : (
        <div className="px-4 py-4 text-[13px] text-ink-soft">{s.empty}</div>
      )}
    </Card>
  );
}
