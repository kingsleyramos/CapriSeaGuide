import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The report's base surface: rounded, hairline-bordered white card.
 *  Padding is left to the caller so each section can set its own rhythm. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-surface", className)}
      {...props}
    />
  );
}
