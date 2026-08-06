import type { ComponentProps, ReactNode } from "react";
import type { GrottoDisplayTone } from "@/config/copy";
import type { PillTone } from "@/config/tuning";
import type { DisplayTone } from "@/lib/forecast/view";
import { confDotClass, grottoChipClass, pillClass, verdictChipClass } from "@/lib/tones";
import { cn } from "@/lib/utils";

const chipBase =
  "inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-bold uppercase leading-none tracking-[0.02em] text-chip-ink whitespace-nowrap";

/** Verdict chip (Calm / Good / Uncertain / Likely off / Off). */
export function VerdictChip({
  tone,
  children,
  className,
}: {
  tone: DisplayTone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn(chipBase, verdictChipClass[tone], className)}>{children}</span>;
}

/** Live Blue Grotto status chip (Open now / Closed now / Closed / Unknown). */
export function GrottoChip({
  tone,
  children,
}: {
  tone: GrottoDisplayTone;
  children: ReactNode;
}) {
  return <span className={cn(chipBase, grottoChipClass[tone])}>{children}</span>;
}

/** "Chance it's off" percentage pill. */
export function OddsPill({
  tone,
  children,
  className,
}: {
  tone: PillTone | "none";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-bold tabular-nums whitespace-nowrap",
        pillClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small confidence indicator dot. */
export function ConfDot({
  tone,
  className,
}: {
  tone: keyof typeof confDotClass;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", confDotClass[tone], className)}
    />
  );
}

/** Neutral rounded stat/number token used in the detail rows. */
export function StatToken({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
