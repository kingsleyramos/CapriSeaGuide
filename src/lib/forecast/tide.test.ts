import { describe, expect, it } from "vitest";
import { GROTTO } from "@/config/tuning";

/** The executable half of why hourly water level is not a grotto input: soften the
 *  curve and the objection in `grottoProb` no longer holds, so these should fail. */

describe("a one-for-one tide coupling is not credible against this curve", () => {
  it("the tidal swing is wider than the whole 10-90% transition", () => {
    // A logistic moves from 10% to 90% across 2 * k * ln(9).
    const transitionWidth = 2 * GROTTO.swell.effK * Math.log(9);
    const gulfOfNaplesSwing = 0.41; // m, high to low

    expect(transitionWidth).toBeLessThan(gulfOfNaplesSwing);

    // So tide alone would carry an ordinary morning across the whole curve and
    // back, where nearly every recorded day shows at most one change.
  });

  it("would need a softer curve before tide could shift a day rather than decide it", () => {
    // Scale check, not a target: spanning the swing needs k around 0.093.
    const kThatWouldWork = 0.41 / (2 * Math.log(9));
    expect(kThatWouldWork).toBeGreaterThan(GROTTO.swell.effK);
    expect(kThatWouldWork / GROTTO.swell.effK).toBeGreaterThan(1.4);
  });
});
