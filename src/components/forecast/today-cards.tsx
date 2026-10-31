import { COPY } from "@/config/copy";
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
    </Card>
  );
}

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
