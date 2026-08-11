import { ChevronDown } from "lucide-react";
import { COPY } from "@/config/copy";
import type { DayForecast } from "@/lib/forecast/types";
import { buildDayRow, type VerdictView } from "@/lib/forecast/view";
import { Card } from "@/components/ui/card";
import { ConfDot, OddsPill, StatToken, VerdictChip } from "@/components/ui/chip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/** AM/PM three-column layout shared by the detail header and each activity row. */
const GRID = "grid grid-cols-[minmax(140px,1fr)_64px_64px] items-center gap-2";

function SlotVerdictChip({ verdict, prefix }: { verdict: VerdictView; prefix: string }) {
  return (
    <VerdictChip tone={verdict.tone} className="px-2.5 py-1.5 text-xs">
      {/* mr-1, not a trailing space: flex would collapse it. No opacity fade:
          anything under ~0.92 fails WCAG AA contrast on these chip fills. */}
      <span className="mr-1 font-semibold">{prefix}</span>
      {verdict.label}
    </VerdictChip>
  );
}

function DayRow({ day, now, timezone }: { day: DayForecast; now: Date; timezone: string }) {
  const row = buildDayRow(day, now, timezone);
  if (!row) return null;
  const s = COPY.sevenDay;

  return (
    <Collapsible className="border-b border-line-soft last:border-b-0">
      <CollapsibleTrigger className="group flex w-full cursor-pointer flex-wrap items-center justify-between gap-3.5 px-5 py-3.5 text-left hover:bg-surface-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink">
        <span className="min-w-60 flex-1 basis-64">
          <span className="mb-0.5 flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-ink">{row.label}</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-mute">
              <ConfDot tone={row.confidence.tone} className="size-[7px]" />
              {row.confidence.short}
            </span>
          </span>
          <span className="block text-[13.5px] leading-snug text-ink-soft">{row.line}</span>
        </span>

        <span className="flex items-center gap-2">
          <SlotVerdictChip verdict={row.morning} prefix={s.morningLabel} />
          <SlotVerdictChip verdict={row.afternoon} prefix={s.afternoonLabel} />
          <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-surface-muted text-ink-soft">
            <ChevronDown className="size-3 transition-transform duration-150 group-data-[state=open]:rotate-180" />
          </span>
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t border-line bg-surface-muted px-5 pb-5 pt-1">
          <div className="flex items-center gap-2 py-3 text-[13px] font-medium text-ink-soft">
            <ConfDot tone={row.confidence.tone} />
            {row.confidence.line}
          </div>

          <div className={`${GRID} border-b border-line pb-2`}>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
              {s.chanceOff}
            </div>
            <div className="text-center text-xs font-bold text-ink-soft">{s.morningLabel}</div>
            <div className="text-center text-xs font-bold text-ink-soft">{s.afternoonLabel}</div>
          </div>

          {row.activities.map((a) => (
            <div key={a.key} className={`${GRID} border-b border-line py-2`}>
              <div className="text-sm font-medium text-ink">{a.name}</div>
              <div className="text-center">
                <OddsPill tone={a.morningTone} className="text-[12.5px]">
                  {a.morningPct}
                </OddsPill>
              </div>
              <div className="text-center">
                <OddsPill tone={a.afternoonTone} className="text-[12.5px]">
                  {a.afternoonPct}
                </OddsPill>
              </div>
            </div>
          ))}

          <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-ink-mute">
            {s.numbersHeading}
          </div>
          <div className="flex flex-wrap gap-2">
            {row.numbers.map((n) => (
              <StatToken key={n.label}>
                <span className="font-medium text-ink-mute">{n.label} </span>
                <span className="font-semibold text-ink">{n.value}</span>
              </StatToken>
            ))}
          </div>

          <div className="mt-3 text-[13.5px] leading-relaxed text-ink-soft text-pretty">
            {row.why}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SevenDay({
  days,
  now,
  timezone,
}: {
  days: DayForecast[];
  now: Date;
  timezone: string;
}) {
  const s = COPY.sevenDay;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line-soft px-5 pb-3 pt-4">
        <h2 className="text-base font-bold">{s.title}</h2>
        <div className="text-[13px] font-medium text-ink-soft">{s.subtitle}</div>
      </div>
      {days.map((day) => (
        <DayRow key={day.date} day={day} now={now} timezone={timezone} />
      ))}
    </Card>
  );
}
