import { COPY } from "@/config/copy";
import { Button } from "@/components/ui/button";

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
