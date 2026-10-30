import { describe, expect, it } from "vitest";
import { springIndex } from "./moon";

describe("springIndex", () => {
  it.each([
    ["new moon, total solar eclipse", "2026-08-12T17:37:00Z"],
    ["full moon, partial lunar eclipse", "2026-08-28T04:18:00Z"],
    ["new moon, annular solar eclipse", "2027-02-06T15:56:00Z"],
    ["full moon, total lunar eclipse", "2025-09-07T18:09:00Z"],
  ])("peaks at a %s", (_name, at) => {
    expect(springIndex(Date.parse(at))).toBeGreaterThan(0.97);
  });

  it("bottoms out midway between them", () => {
    const midway = (Date.parse("2026-08-12T17:37:00Z") + Date.parse("2026-08-28T04:18:00Z")) / 2;
    expect(springIndex(midway)).toBeLessThan(-0.9);
  });

  it("repeats every half lunation", () => {
    const at = Date.parse("2026-10-01T00:00:00Z");
    expect(springIndex(at + 14.765 * 86_400_000)).toBeCloseTo(springIndex(at), 0);
  });
});
