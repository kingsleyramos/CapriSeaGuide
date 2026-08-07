import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Contrast floors for the timeline, asserted against globals.css itself.
 *
 * These bars are the only place a colour carries meaning with no text beside
 * it, so a token nudged for looks can drop a state below legibility silently.
 */

const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

/** Hex tokens declared inside a block. Matched on a pattern, not a literal, so
 *  reformatting the stylesheet cannot quietly stop this file from checking it. */
function palette(selector: RegExp): Record<string, string> {
  const match = selector.exec(css);
  if (!match) throw new Error(`block not found: ${selector}`);
  const open = css.indexOf("{", match.index);
  const block = css.slice(open, css.indexOf("\n}", open));
  const out: Record<string, string> = {};
  for (const [, name, hex] of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    out[name] = hex;
  }
  return out;
}

const luminance = (hex: string) => {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const themes = {
  light: palette(/@theme\b/),
  dark: palette(/:root\[data-theme=['"]dark['"]\]/),
};

describe.each(Object.entries(themes))("%s timeline tokens", (_name, t) => {
  const fills = ["bar-expected", "bar-possible", "bar-none", "grotto-open", "grotto-closed"];

  // 1.4.11 asks the object to be distinguishable, not the fill specifically, so
  // a light fill qualifies on the strength of its outline.
  it.each(fills)("%s is bounded at 3:1 against the card, by fill or by edge", (token) => {
    const edge = t[`${token}-edge`];
    const best = Math.max(
      ratio(t[token], t["surface-raised"]),
      edge ? ratio(edge, t["surface-raised"]) : 0,
    );
    expect(best).toBeGreaterThanOrEqual(3);
  });

  it("gives an edge to every fill that cannot carry 3:1 alone", () => {
    const unbounded = fills.filter(
      (token) => ratio(t[token], t["surface-raised"]) < 3 && !t[`${token}-edge`],
    );
    expect(unbounded).toEqual([]);
  });

  it("keeps the 'No data' label readable on its own fill", () => {
    // 11px text, so the 4.5:1 body-text floor applies, not the 3:1 large-text one.
    expect(ratio(t["bar-none-fg"], t["bar-none"])).toBeGreaterThanOrEqual(4.5);
  });

  it("separates the three forecast states by lightness, not hue alone", () => {
    // Deuteranopia collapses green and amber; without a lightness step the bars
    // become one block. Not a WCAG threshold -- a floor against re-flattening.
    const [expected, possible, none] = ["bar-expected", "bar-possible", "bar-none"].map(
      (k) => luminance(t[k]),
    );
    const spread = Math.max(expected, possible, none) - Math.min(expected, possible, none);
    expect(spread).toBeGreaterThan(0.05);
  });

  it("keeps a forecast fill distinguishable from the reported tone it echoes", () => {
    expect(ratio(t["bar-expected"], t["grotto-open"])).toBeGreaterThan(1.2);
    expect(ratio(t["bar-possible"], t["grotto-closed"])).toBeGreaterThan(1.2);
  });
});
