import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The report's base surface. surface-raised equals the page in daylight and
 *  lifts off it at night. Padding is the caller's, so sections set their own
 *  rhythm. A section because every card is a labelled region of the report
 *  carrying its own heading. */
export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-2xl border border-line bg-surface-raised", className)}
      {...props}
    />
  );
}
