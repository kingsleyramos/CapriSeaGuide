"use client";

import { ChevronDown } from "lucide-react";
import { COPY } from "@/config/copy";
import { buildGrottoHistory, type HistoryRow } from "@/lib/forecast/grotto-view";
import { useGrottoHistory } from "@/hooks/use-grotto-history";
import { Card } from "@/components/ui/card";
import { OddsPill, StatToken } from "@/components/ui/chip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const triggerFocus =
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink";

/** One day: modeled AM/PM grotto odds, expanding to the sea report behind them. */
function HistoryDayRow({ row }: { row: HistoryRow }) {
  const s = COPY.grottoHistory;
  return (
    <Collapsible className="border-b border-line-soft last:border-b-0">
      <CollapsibleTrigger
        className={`group flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-3 text-left hover:bg-surface-soft ${triggerFocus}`}
      >
        <span className="text-[15px] font-bold text-ink">{row.label}</span>
        <span className="flex items-center gap-2">
          <OddsPill tone={row.am.tone} className="text-xs">
            <span className="mr-1 font-semibold opacity-70">{s.amLabel}</span>
            {row.am.pctText}
          </OddsPill>
          <OddsPill tone={row.pm.tone} className="text-xs">
            <span className="mr-1 font-semibold opacity-70">{s.pmLabel}</span>
            {row.pm.pctText}
          </OddsPill>
          <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-surface-muted text-ink-soft">
            <ChevronDown className="size-3 transition-transform duration-150 group-data-[state=open]:rotate-180" />
          </span>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-surface-muted px-5 pb-4 pt-2">
          {/* Recorded reality, shown once the recorder has logged this day. */}
          {row.reported ? (
            <div className="mb-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">
                {s.reportedHeading}
              </div>
              <div className="text-[13px] font-medium text-ink">
                {s.amLabel} {row.reported.am} · {s.pmLabel} {row.reported.pm}
              </div>
              {row.changes && row.changes.length > 0 ? (
                <>
                  <div className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wider text-ink-mute">
                    {s.changesHeading}
                  </div>
                  <ul className="grid gap-1 text-[13px] text-ink-soft">
                    {row.changes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : (
            <div className="mb-3 text-[13px] text-ink-mute">{s.noRecord}</div>
          )}

          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">
            {s.seaHeading}
          </div>
          <div className="flex flex-wrap gap-2">
            {row.numbers.map((n) => (
              <StatToken key={n.label}>
                <span className="font-medium text-ink-mute">{n.label} </span>
                <span className="font-semibold text-ink">{n.value}</span>
              </StatToken>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Collapsible "Blue Grotto, last 7 days" section (model hindcast, no DB). */
export function GrottoHistory() {
  const days = useGrottoHistory();
  const s = COPY.grottoHistory;
  const rows = days ? buildGrottoHistory(days) : [];

  return (
    <Card className="overflow-hidden">
      <Collapsible>
        <CollapsibleTrigger
          className={`group flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left hover:bg-surface-soft ${triggerFocus}`}
        >
          <span>
            <span className="block text-base font-bold text-ink">{s.title}</span>
            <span className="block text-[13px] font-medium text-ink-soft">{s.subtitle}</span>
          </span>
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-soft">
            <ChevronDown className="size-3.5 transition-transform duration-150 group-data-[state=open]:rotate-180" />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-line-soft px-5 py-2 text-xs text-ink-mute">
            {s.modelNote}
          </div>
          {rows.length ? (
            rows.map((row) => <HistoryDayRow key={row.date} row={row} />)
          ) : (
            <div className="px-5 py-4 text-[13px] text-ink-soft">{s.empty}</div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
