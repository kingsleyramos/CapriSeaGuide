"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

/** Accessible show/hide (keyboard + aria-expanded), used for the "Sea details"
 *  reveal and every expandable day row. */
export const Collapsible = CollapsiblePrimitive.Root;
export const CollapsibleTrigger = CollapsiblePrimitive.Trigger;
export const CollapsibleContent = CollapsiblePrimitive.Content;
