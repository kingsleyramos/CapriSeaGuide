"use client";

import { ChevronDown } from "lucide-react";
import { COPY } from "@/config/copy";
import {
  buildGrottoTimeline,
  type BarTone,
  type GrottoView,
  type HistoryAxisLabel,
  type HistoryDayView,
  type TimelineBarSegment,
  type TodayView,
} from "@/lib/forecast/grotto-view";
import { useGrottoHistory } from "@/hooks/use-grotto-history";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { GrottoChip } from "@/components/ui/chip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/** Left label column; shared by the today bar, the axis, and every history row
 *  so the bars line up vertically. */
const GUTTER = "w-[76px] shrink-0";
/** Right column that matches the history rows' chevron, so bars share a width. */
const CHEVRON_COL = "size-4 shrink-0";

/** Bar fill for a tone: solid for reported, pale for forecast, muted for none. */
function barFillClass(tone: TimelineBarSegment["tone"]): string {
  switch (tone) {
    case "open":
      return "bg-grotto-open";
    case "closed":
      return "bg-grotto-closed";
    case "expectedOpen":
      return "bg-pill-low-bg";
    case "possibleClosure":
      return "bg-pill-mid-bg";
    default:
      return "bg-surface-muted";
  }
}

/** Status pill in the expanded grid: solid for reported, muted for a no-data day. */
function statusPillClass(tone: BarTone): string {
  switch (tone) {
    case "open":
      return "bg-grotto-open text-white";
    case "closed":
      return "bg-grotto-closed text-white";
    case "expectedOpen":
      return "bg-pill-low-bg text-pill-low-fg";
    case "possibleClosure":
      return "bg-pill-mid-bg text-pill-mid-fg";
    default:
      return "bg-pill-none-bg text-pill-none-fg"; // "none" = No data
  }
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

function Legend() {
  const s = COPY.grottoHistory.legend;
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-ink-soft">
      <LegendSwatch className="bg-grotto-open" label={s.open} />
      <LegendSwatch className="bg-grotto-closed" label={s.closed} />
      <LegendSwatch className="border border-line bg-pill-low-bg" label={s.expectedOpen} />
      <LegendSwatch className="border border-line bg-pill-mid-bg" label={s.possibleClosure} />
      <LegendSwatch className="border border-dashed border-line bg-surface-muted" label={s.none} />
    </div>
  );
}

/** Shared time axis (09:00 … close). First label left-aligns, last right-aligns. */
function Axis({ axis }: { axis: HistoryAxisLabel[] }) {
  return (
    <div className="flex items-center gap-3">
      <span className={GUTTER} />
      <div className="relative h-4 flex-1">
        {axis.map((a, i) => (
          <span
            key={a.label}
            className="absolute top-0 text-[11px] tabular-nums text-ink-mute"
            style={{
              left: `${a.pct}%`,
              transform:
                i === 0
                  ? "none"
                  : i === axis.length - 1
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
            }}
          >
            {a.label}
          </span>
        ))}
      </div>
      <span className={CHEVRON_COL} />
    </div>
  );
}

/** Today's bar: reported so far (solid) then forecast to close (pale), with a
 *  divider at the last check. No inner gaps, so the divider lands exactly on the
 *  reported/forecast boundary. */
function TodayRow({ today }: { today: TodayView }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span className={cn(GUTTER, "text-[13px] font-semibold text-ink")}>{today.label}</span>
        <div className="relative flex-1">
          <div
            role="img"
            aria-label={`${today.label}: Blue Grotto reported so far, then forecast to closing`}
            className="flex h-[22px] overflow-hidden rounded-md border border-line bg-surface"
          >
            {today.bar.map((seg, i) => (
              <span
                key={i}
                className={cn("flex items-center overflow-hidden", barFillClass(seg.tone))}
                style={{ width: `${seg.widthPct}%` }}
              >
                {seg.label ? (
                  <span className="whitespace-nowrap pl-1.5 text-[11px] font-medium text-white">
                    {seg.label}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          {today.dividerPct != null && (
            <span
              aria-hidden
              className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded bg-ink"
              style={{ left: `${today.dividerPct}%` }}
            />
          )}
        </div>
        <span className={CHEVRON_COL} />
      </div>

      {today.dividerLabel && today.dividerPct != null && (
        <div className="mt-1 flex items-center gap-3">
          <span className={GUTTER} />
          <div className="relative h-3.5 flex-1">
            <span
              className="absolute top-0 whitespace-nowrap text-[10px] text-ink-mute"
              style={{
                left: `${today.dividerPct}%`,
                transform:
                  today.dividerPct > 60
                    ? "translateX(-100%)"
                    : today.dividerPct < 12
                      ? "none"
                      : "translateX(-50%)",
              }}
            >
              {today.dividerLabel}
            </span>
          </div>
          <span className={CHEVRON_COL} />
        </div>
      )}
    </>
  );
}

/** One history day: a tap-anywhere row (label + bar + chevron) that expands to
 *  the sea behind each segment. */
function HistoryDayRow({ view }: { view: HistoryDayView }) {
  const s = COPY.grottoHistory;
  return (
    <Collapsible className="border-b border-line-soft last:border-b-0">
      <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left hover:bg-surface-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink">
        <span className={cn(GUTTER, "text-[13px] font-semibold text-ink")}>{view.label}</span>
        <span className="flex h-[22px] flex-1 gap-px overflow-hidden rounded-md border border-line bg-surface">
          {view.bar.map((seg, i) => (
            <span
              key={i}
              className={cn("flex items-center overflow-hidden", barFillClass(seg.tone))}
              style={{ width: `${seg.widthPct}%` }}
            >
              {seg.tone === "none" ? (
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
        <div className="overflow-x-auto bg-surface-muted px-5 py-3">
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
                      {row.tone === "none" ? (
                        <span className="text-xs text-ink-mute">{row.statusLabel}</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            statusPillClass(row.tone),
                          )}
                        >
                          {row.statusLabel}
                        </span>
                      )}
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

/**
 * Blue Grotto: live status, today's timeline, and the last-7-day history in one
 * card. The status row keeps its original styling; the bar and history are added
 * below it. `view` is the resolved live status (see buildGrottoView).
 */
export function GrottoStatus({ view }: { view: GrottoView }) {
  const c = COPY.grottoBar;
  const s = COPY.grottoHistory;
  const data = useGrottoHistory();
  const timeline = data ? buildGrottoTimeline(data) : null;

  return (
    <Card className="overflow-hidden">
      {/* Live status — unchanged from the standalone bar. */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 px-5 py-4">
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
      </div>

      {/* Today's timeline: reported so far + forecast. */}
      {timeline?.today && (
        <div className="px-5 pb-4">
          <Legend />
          <div className="mb-1.5">
            <Axis axis={timeline.axis} />
          </div>
          <TodayRow today={timeline.today} />
        </div>
      )}

      {/* Last 7 days: a drop-down of the completed history. */}
      {timeline && timeline.days.length > 0 && (
        <Collapsible className="border-t border-line">
          <CollapsibleTrigger className="group flex w-full cursor-pointer items-center justify-between px-5 py-3.5 text-left hover:bg-surface-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink">
            <span className="text-[14px] font-semibold text-ink">{s.historyToggle}</span>
            <ChevronDown className="size-4 shrink-0 text-ink-mute transition-transform duration-150 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-line-soft px-5 pb-2 pt-3">
              <Axis axis={timeline.axis} />
            </div>
            {timeline.days.map((d) => (
              <HistoryDayRow key={d.date} view={d} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}
