import { COPY } from "@/config/copy";
import { Button } from "@/components/ui/button";

/* The whole-page loading state used to live here. It is gone because the page
 * no longer has one: each card carries its own placeholder (./skeletons), so
 * there is nothing left that blocks on every fetch at once. */

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
