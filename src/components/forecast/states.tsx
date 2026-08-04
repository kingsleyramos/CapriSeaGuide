import { COPY } from "@/config/copy";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Shimmering placeholder shown on first load. */
export function LoadingReport() {
  return (
    <div className="grid gap-3 pt-2 [animation:shimmer_1.4s_ease-in-out_infinite]">
      <Skeleton className="h-[120px]" />
      <Skeleton className="h-[180px]" />
      <Skeleton className="h-80" />
      <div className="text-center text-[13px] text-ink-mute">{COPY.states.loading}</div>
    </div>
  );
}

export function ErrorReport({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-danger-line bg-danger-bg p-5">
      <div className="mb-1.5 text-[17px] font-semibold">{COPY.states.errorTitle}</div>
      <div className="text-sm leading-relaxed text-ink-soft">{message}</div>
      <Button className="mt-3.5" onClick={onRetry}>
        {COPY.states.retry}
      </Button>
    </div>
  );
}
