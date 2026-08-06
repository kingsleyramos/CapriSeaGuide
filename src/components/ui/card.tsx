import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The report's base surface. surface-raised equals the page in daylight and
 *  lifts off it at night. Padding is the caller's, so sections set their own
 *  rhythm. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-line bg-surface-raised", className)}
      {...props}
    />
  );
}
