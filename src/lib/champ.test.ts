import { describe, expect, it } from "vitest";
import { capEligibility, isValidSlot, payoutSplit, upcomingSlots, CHAMP_CAPS } from "./champ";

describe("SMYD Champ rules", () => {
  it("has 16 divisions", () => expect(CHAMP_CAPS.length).toBe(16));
  it("pays nothing under 3 players", () => expect(payoutSplit(2)).toEqual([]));
  it("3 players: $57 pool split 65/35", () => expect(payoutSplit(3)).toEqual([3705, 1995]));
  it("8 players pays top 3", () => expect(payoutSplit(8)).toEqual([7600, 4560, 3040]));
  it("16 players pays top 4", () => expect(payoutSplit(16).reduce((a, b) => a + b, 0)).toBe(30400));
  it("closes registration 30 min before start", () => {
    const start = Date.UTC(2026, 10, 1, 18, 0);
    expect(isValidSlot(start, start - 31 * 60000)).toBe(true);
    expect(isValidSlot(start, start - 29 * 60000)).toBe(false);
  });
  it("first open slot is after cutoff", () => {
    const now = Date.UTC(2026, 10, 1, 17, 40);
    expect(upcomingSlots(now, 1)[0]).toBe(Date.UTC(2026, 10, 1, 18, 30));
  });
  it("capped divisions need a verified MPR at or under cap", () => {
    expect(capEligibility("open", null, false)).toBeNull();
    expect(capEligibility("3.0", 2.8, false)).not.toBeNull();
    expect(capEligibility("3.0", 2.8, true)).toBeNull();
    expect(capEligibility("3.0", 3.2, true)).not.toBeNull();
  });
});
