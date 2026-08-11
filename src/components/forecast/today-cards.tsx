import { COPY } from "@/config/copy";
import type { PillTone } from "@/config/tuning";
import { cn } from "@/lib/utils";
import type { TodayCardView } from "@/lib/forecast/view";
import { Card } from "@/components/ui/card";
import { ConfDot, OddsPill, VerdictChip } from "@/components/ui/chip";

function TodaySlotCard({ card }: { card: TodayCardView }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2.5">
        <div>
          <h2 className="text-base font-bold text-ink">{card.title}</h2>
          <div className="text-[12.5px] font-medium text-ink-mute">{card.sub}</div>
        </div>
        <VerdictChip tone={card.verdict.tone}>{card.verdict.label}</VerdictChip>
      </div>

      <div className="text-[14.5px] leading-normal text-ink text-pretty">{card.line}</div>

      <div className="my-3 flex items-center gap-2 text-[13px] font-medium text-ink-soft">
        <ConfDot tone={card.confidence.tone} />
        {card.confidence.line}
      </div>

      <div className="grid gap-2.5 border-t border-line-soft pt-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
          {COPY.today.topHeading}
        </div>
        {card.top.map((odd) => (
          <div key={odd.key} className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-ink">{odd.name}</span>
            <OddsPill tone={odd.tone}>{odd.pct}</OddsPill>
          </div>
        ))}
      </div>

      {card.hourly && <HourStrip hours={card.hourly} />}
    </Card>
  );
}

/** The slot's grotto odds hour by hour: an average reads "borderline" across a
 *  morning that is fine at 09:00 and unworkable by 12:00. */
function HourStrip({ hours }: { hours: NonNullable<TodayCardView["hourly"]> }) {
  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-ink-mute">
        {COPY.today.hourlyHeading}
      </div>
      <div
        className="flex gap-1"
        role="img"
        aria-label={COPY.today.hourlyAria(hours[0].label, hours[hours.length - 1].label)}
      >
        {hours.map((h) => (
          <div key={h.hour} className="flex-1 text-center" aria-hidden>
            <div className={cn("h-1.5 rounded-full", hourFillClass[h.tone])} />
            <div className="mt-1 text-[10px] font-medium tabular-nums text-ink-mute">
              {h.label.slice(0, 2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Solid fills, not the pill backgrounds: these are 6px bars with no text on
 *  them, so they need the foreground's weight to stay visible. */
const hourFillClass: Record<PillTone, string> = {
  low: "bg-pill-low-fg",
  mid: "bg-pill-mid-fg",
  high: "bg-pill-high-fg",
};

export function TodayCards({ cards }: { cards: TodayCardView[] }) {
  if (!cards.length) return null;
  return (
    <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(290px,1fr))]">
      {cards.map((card) => (
        <TodaySlotCard key={card.key} card={card} />
      ))}
    </div>
  );
}
