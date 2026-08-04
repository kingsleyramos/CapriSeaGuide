import { ChevronDown } from "lucide-react";
import { COPY } from "@/config/copy";
import type { NowView } from "@/lib/forecast/view";
import { nowTintClass } from "@/lib/tones";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatToken, VerdictChip } from "@/components/ui/chip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/** The headline "right now" card, with an expandable sea-details reveal. */
export function NowCard({ now }: { now: NowView }) {
  const c = COPY.now;
  return (
    <Card className={cn("p-5", nowTintClass[now.tint])}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <VerdictChip tone={now.verdict.tone}>{now.verdict.label}</VerdictChip>
          <span className="text-sm font-semibold text-ink">{c.title}</span>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-[13px] font-semibold tabular-nums text-ink">
            {now.capriNowLine}
          </div>
          <div className="text-xs font-medium text-ink-soft">
            {c.updatedPrefix} {now.updatedLine} · {c.refreshNote}
          </div>
        </div>
      </div>

      <Collapsible>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-[56ch] flex-1 basis-80 text-lg font-semibold leading-snug text-ink text-pretty">
            {now.headline}
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="pill" className="group">
              {c.seaDetails}
              <ChevronDown className="size-3.5 transition-transform duration-150 group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {now.stats.map((s) => (
              <StatToken key={s.label}>
                <span className="font-medium text-ink-mute">{s.label} </span>
                <span className="font-semibold text-ink">{s.value}</span>
              </StatToken>
            ))}
          </div>
          <div className="mt-3 text-[13px] font-medium text-ink-soft">{now.pattern}</div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
