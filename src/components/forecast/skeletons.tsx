import { COPY } from "@/config/copy";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholders for the cards that cannot render until the forecast lands.
 *
 * Each one mirrors its card element for element, because the goal is height,
 * not decoration: whatever the placeholder reserves is what the real content
 * has to fit into, or the swap shifts the page. So every stand-in sits in the
 * same typographic context as the copy it replaces and lets the browser
 * measure it — see the `text` and `copy` variants in ui/skeleton.
 */

export function NowCardSkeleton() {
  const c = COPY.now;
  return (
    <Card className="p-5" aria-busy>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton variant="pill" className="w-[68px]" />
          <span className="text-sm font-semibold">
            <Skeleton variant="text" className="w-28" />
          </span>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-[13px] font-semibold tabular-nums">
            <Skeleton variant="text" className="w-52" />
          </div>
          <div className="text-xs font-medium">
            <Skeleton variant="text" className="w-64" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-[56ch] flex-1 basis-80 text-pretty text-lg font-semibold leading-snug">
          <Skeleton variant="copy">Calm sea and light wind. No weather closures expected.</Skeleton>
        </div>
        {/* the "Sea details" pill, at its own type scale and padding */}
        <Skeleton variant="pill" className="px-3.5 py-2 text-[13px] font-semibold normal-case">
          {c.seaDetails}
        </Skeleton>
      </div>
    </Card>
  );
}

function TodaySlotCardSkeleton() {
  return (
    <Card className="p-5" aria-busy>
      <div className="mb-3 flex items-center justify-between gap-2.5">
        <div>
          <div className="text-base font-bold">
            <Skeleton variant="text" className="w-32" />
          </div>
          <div className="text-[12.5px] font-medium">
            <Skeleton variant="text" className="w-24" />
          </div>
        </div>
        <Skeleton variant="pill" className="w-[68px]" />
      </div>

      <div className="text-pretty text-[14.5px] leading-normal">
        <Skeleton variant="copy">Calm sea and light wind. No weather closures expected.</Skeleton>
      </div>

      <div className="my-3 flex items-center gap-2 text-[13px] font-medium">
        <Skeleton variant="text" className="w-2 rounded-full" />
        <Skeleton variant="text" className="w-56" />
      </div>

      <div className="grid gap-2.5 border-t border-line-soft pt-3">
        <div className="text-xs font-semibold uppercase tracking-wider">
          <Skeleton variant="text" className="w-48" />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">
              <Skeleton variant="text" className="w-36" />
            </span>
            <Skeleton variant="pill" className="px-2.5 py-0.5 tabular-nums">
              00%
            </Skeleton>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Two slot cards, in the same auto-fit grid the real pair uses. */
export function TodayCardsSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] gap-3.5">
      <TodaySlotCardSkeleton />
      <TodaySlotCardSkeleton />
    </div>
  );
}

/** One collapsed day row, matching DayRow's trigger padding and chip row. */
function DayRowSkeleton() {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3.5 border-b border-line-soft px-5 py-3.5 last:border-b-0">
      <span className="min-w-60 flex-1 basis-64">
        <span className="mb-0.5 flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold">
            <Skeleton variant="text" className="w-40" />
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <Skeleton variant="text" className="w-32" />
          </span>
        </span>
        <span className="block text-[13.5px] leading-snug">
          <Skeleton variant="text" className="w-full" />
        </span>
      </span>

      <span className="flex items-center gap-2">
        <Skeleton variant="pill" className="w-[86px] px-2.5 py-1.5 text-xs" />
        <Skeleton variant="pill" className="w-[86px] px-2.5 py-1.5 text-xs" />
        <Skeleton variant="text" className="size-[22px] rounded-full" />
      </span>
    </div>
  );
}

export function SevenDaySkeleton() {
  return (
    <Card className="overflow-hidden" aria-busy>
      <div className="border-b border-line-soft px-5 pb-3 pt-4">
        <div className="text-base font-bold">
          <Skeleton variant="text" className="w-36" />
        </div>
        <div className="text-[13px] font-medium">
          <Skeleton variant="text" className="w-56" />
        </div>
      </div>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <DayRowSkeleton key={i} />
      ))}
    </Card>
  );
}
