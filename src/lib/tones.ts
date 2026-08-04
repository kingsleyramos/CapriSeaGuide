/**
 * Maps the engine's semantic tones to design-system utility classes. This is
 * the boundary where "how likely" becomes "what colour" — the only place that
 * decision lives, so re-theming is a token edit (globals.css) away.
 */

import type { ConfidenceTone, GrottoStatus } from "@/config/copy";
import type { NowTone, PillTone } from "@/config/tuning";
import type { DisplayTone } from "@/lib/forecast/view";

/** Verdict / status chip fills (white text). */
export const verdictChipClass: Record<DisplayTone, string> = {
  calm: "bg-calm",
  good: "bg-good",
  uncertain: "bg-uncertain",
  likelyOff: "bg-likely",
  off: "bg-off",
  none: "bg-none",
};

/** "Chance it's off" pill foreground+background. */
export const pillClass: Record<PillTone | "none", string> = {
  low: "bg-pill-low-bg text-pill-low-fg",
  mid: "bg-pill-mid-bg text-pill-mid-fg",
  high: "bg-pill-high-bg text-pill-high-fg",
  none: "bg-pill-none-bg text-pill-none-fg",
};

export const confDotClass: Record<ConfidenceTone, string> = {
  high: "bg-conf-high",
  medium: "bg-conf-medium",
  low: "bg-conf-low",
};

export const nowTintClass: Record<NowTone, string> = {
  calm: "bg-tint-calm",
  uncertain: "bg-tint-uncertain",
  off: "bg-tint-off",
};

export const grottoChipClass: Record<GrottoStatus, string> = {
  open: "bg-grotto-open",
  closed: "bg-grotto-closed",
  unknown: "bg-grotto-unknown",
};
