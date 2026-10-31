import { describe, expect, it } from "vitest";
import { memberOf, parseMember } from "./grotto-log";

/** The log is append-only, so a format change must never orphan older rows. */

describe("memberOf / parseMember round-trip", () => {
  it("carries status and conflict back out", () => {
    const reading = { t: 1786018714442, status: "closed" as const, conflict: true };
    expect(parseMember(memberOf(reading))).toEqual(reading);
  });

  it("keeps conflict false rather than absent when a reading is agreed", () => {
    const parsed = parseMember(memberOf({ t: 1786018714442, status: "open" }));
    expect(parsed).toEqual({ t: 1786018714442, status: "open", conflict: false });
  });

  it("stays unique per reading, since sorted-set members overwrite by value", () => {
    expect(memberOf({ t: 1, status: "open" })).not.toBe(memberOf({ t: 2, status: "open" }));
  });
});

describe("legacy rows recorded before conflict was stored", () => {
  it("still parse", () => {
    expect(parseMember("1786018714442:open")).toEqual({
      t: 1786018714442,
      status: "open",
    });
  });

  it("parse for every status the recorder writes", () => {
    for (const status of ["open", "closed", "unknown"] as const) {
      expect(parseMember(`1786018714442:${status}`)?.status).toBe(status);
    }
  });
});

describe("junk is dropped rather than trusted", () => {
  it.each([
    ["no separator", "1786018714442"],
    ["non-numeric time", "abc:open"],
    ["unknown status word", "1786018714442:maybe"],
    ["truncated json", '{"t":1786018714442,"s":'],
    ["json missing a status", '{"t":1786018714442}'],
    ["json with a bad status", '{"t":1786018714442,"s":"maybe"}'],
    ["json with a non-numeric time", '{"t":"soon","s":"open"}'],
  ])("%s", (_label, member) => {
    expect(parseMember(member)).toBeNull();
  });
});
