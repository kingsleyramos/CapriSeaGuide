import { describe, expect, it } from "vitest";
import { MODEL_VERSION } from "./model-version";
import { noUsableReading, pastRecorderGrace } from "./recorder-health";
import type { GrottoReading } from "./types";

const TZ = "Europe/Rome";
const at = (iso: string) => new Date(Date.parse(iso));
const reading = (status: GrottoReading["status"]): GrottoReading => ({ t: 0, status });

describe("pastRecorderGrace", () => {
  // Summer: Capri is UTC+2. Opening is 09:00, grace runs to 11:00.
  it("stays quiet through the first two hours of the open day", () => {
    expect(pastRecorderGrace(at("2026-08-04T07:00:00Z"), TZ)).toBe(false); // 09:00
    expect(pastRecorderGrace(at("2026-08-04T08:59:00Z"), TZ)).toBe(false); // 10:59
  });

  it("starts caring once the morning has had time to produce something", () => {
    expect(pastRecorderGrace(at("2026-08-04T09:00:00Z"), TZ)).toBe(true); // 11:00
    expect(pastRecorderGrace(at("2026-08-04T14:00:00Z"), TZ)).toBe(true); // 16:00
  });
});

describe("noUsableReading", () => {
  it("is silence when nothing definitive landed", () => {
    expect(noUsableReading([])).toBe(true);
    expect(noUsableReading([reading("unknown"), reading("unknown")])).toBe(true);
  });

  it("is not silence when even one reading is definitive", () => {
    expect(noUsableReading([reading("unknown"), reading("open")])).toBe(false);
    expect(noUsableReading([reading("closed")])).toBe(false);
  });
});

describe("MODEL_VERSION", () => {
  it("is a stable short fingerprint", () => {
    expect(MODEL_VERSION).toMatch(/^[0-9a-f]{8}$/);
    expect(MODEL_VERSION).toBe(MODEL_VERSION);
  });
});
