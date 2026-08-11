import { describe, expect, it } from "vitest";
import { GROTTO } from "@/config/tuning";

/** The executable half of why tide is not a grotto input: soften the curve and
 *  the objection in `grottoProb` no longer holds, so these should fail. */

describe("a one-for-one tide coupling is not credible against this curve", () => {
  it("the tidal swing is wider than the whole 10-90% transition", () => {
    // A logistic moves from 10% to 90% across 2 * k * ln(9).
    const transitionWidth = 2 * GROTTO.effectiveWave.k * Math.log(9);
    const gulfOfNaplesSwing = 0.41; // m, high to low

    expect(transitionWidth).toBeLessThan(gulfOfNaplesSwing);

    // So tide alone would carry an ordinary morning across the whole curve and
    // back. Six recorded days show at most one change each.
  });

  it("would need a softer curve before tide could shift a day rather than decide it", () => {
    // Scale check, not a target: spanning the swing needs k around 0.093.
    const kThatWouldWork = 0.41 / (2 * Math.log(9));
    expect(kThatWouldWork).toBeGreaterThan(GROTTO.effectiveWave.k);
    expect(kThatWouldWork / GROTTO.effectiveWave.k).toBeGreaterThan(1.4);
  });
});
