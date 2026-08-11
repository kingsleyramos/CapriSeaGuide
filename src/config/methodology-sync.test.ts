import { describe, expect, it } from "vitest";
import { COPY } from "./copy";
import { HEAD_WEIGHTS, VERDICT_BANDS } from "./tuning";

/** The methodology sentence quotes model constants; these pin it to them. */

const verdictBody = () =>
  COPY.methodology.sections.find((s) => s.lead.toLowerCase().includes("verdict"))!.body;

describe("the verdict-chip explanation is generated from the bands", () => {
  it("quotes every finite band edge", () => {
    for (const band of VERDICT_BANDS.filter((b) => Number.isFinite(b.max))) {
      expect(verdictBody()).toContain(`${Math.round(band.max * 100)}%`);
    }
  });

  it("quotes the head weights", () => {
    expect(verdictBody()).toContain(`${Math.round((HEAD_WEIGHTS.grotto ?? 0) * 100)}%`);
    expect(verdictBody()).toContain(`${Math.round((HEAD_WEIGHTS.tour ?? 0) * 100)}%`);
  });

  it("names every verdict tone", () => {
    for (const tone of VERDICT_BANDS.map((b) => b.tone)) {
      expect(verdictBody()).toContain(COPY.verdictLabel[tone]);
    }
  });
});

describe("no user-facing text asserts a figure the code cannot back", () => {
  it("has dropped the unsourced entrance-lift measurement", () => {
    const all = COPY.methodology.sections.map((s) => s.body).join(" ");
    // An unsourced figure that reads as a measurement of the cave.
    expect(all).not.toMatch(/30\s*[–-]\s*40\s*cm/);
  });
});
