import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Placeholder for content that has not arrived yet.
 *
 * The variants exist because a placeholder's job is to hold the exact space its
 * content will take, and "exact" means something different for a box than for a
 * line of prose. A pixel height is only ever right at one viewport, so anything
 * standing in for text instead borrows the surrounding type scale and lets the
 * browser do the arithmetic.
 *
 * Always `aria-hidden`: the filler is shape, not content, and `copy` in
 * particular carries real words that a screen reader must not announce.
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
