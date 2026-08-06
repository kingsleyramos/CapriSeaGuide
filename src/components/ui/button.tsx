import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 font-semibold cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        /** Solid dark action (e.g. Retry). */
        // text-chip-ink, not white: bg-ink is near-black in daylight and near-white
        // at night, so the label has to invert with it.
        primary: "rounded-[10px] bg-ink px-[18px] py-2.5 text-sm text-chip-ink hover:bg-ink/90",
        /** Outlined pill toggle (e.g. Sea details). */
        pill: "rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-ink-soft hover:bg-surface-soft",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export function Button({
  className,
  variant,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
