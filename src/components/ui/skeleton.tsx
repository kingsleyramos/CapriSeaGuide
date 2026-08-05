import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Placeholder for content that has not arrived yet. Text variants borrow the
 * surrounding type scale instead of a pixel height, so the reserved space
 * matches the real content at any viewport. Always aria-hidden: `copy` filler
 * carries real words a screen reader must not announce.
 */
const skeletonVariants = cva(
  "select-none bg-surface-muted text-transparent [animation:shimmer_1.4s_ease-in-out_infinite] motion-reduce:animate-none",
  {
    variants: {
      variant: {
        /** A sized box. Give it a height (and width) through className. */
        block: "block rounded-2xl",
        /** One line box of whatever type scale it sits in: height follows the
         *  parent's font-size and line-height, so it survives a rewrap. */
        text: "inline-block rounded align-middle",
        /** Prose that wraps. Pass filler of a representative length as children
         *  and it breaks across lines like the real sentence would. */
        copy: "box-decoration-clone rounded",
        /** Matches `chipBase` in ui/chip, so a chip's row keeps its height. */
        pill: "inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-bold uppercase leading-none",
      },
    },
    defaultVariants: { variant: "block" },
  },
);

export function Skeleton({
  className,
  variant,
  children,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof skeletonVariants>) {
  return (
    <span className={cn(skeletonVariants({ variant }), className)} aria-hidden {...props}>
      {/* a non-breaking space establishes the line box when there is no filler */}
      {children ?? " "}
    </span>
  );
}
