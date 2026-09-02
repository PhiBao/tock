import { describe, expect, it } from "vitest";
import {
  EMPTY_STREAK,
  applyStreakRecord,
  winRate,
} from "@/lib/streak";
import { legMultiplier, runMultiplier, shouldStop, type RideLeg, type RideState } from "@/lib/ride";

describe("applyStreakRecord", () => {
  it("win increments and tracks best", () => {
    const s1 = applyStreakRecord(EMPTY_STREAK, true, "BTC", "15m", "UP", 1);
    expect(s1.current).toBe(1);
    expect(s1.best).toBe(1);
    expect(s1.wins).toBe(1);
    const s2 = applyStreakRecord(s1, true, "BTC", "15m", "UP", 2);
    expect(s2.current).toBe(2);
    expect(s2.best).toBe(2);
  });
  it("loss resets current but keeps best", () => {
    const s1 = applyStreakRecord(EMPTY_STREAK, true, "BTC", "15m", "UP", 1);
    const s2 = applyStreakRecord(s1, false, "BTC", "15m", "DOWN", 2);
    expect(s2.current).toBe(0);
    expect(s2.best).toBe(1);
    expect(s2.losses).toBe(1);
  });
  it("void preserves the run and counts separately", () => {
    const s1 = applyStreakRecord(EMPTY_STREAK, true, "BTC", "15m", "UP", 1);
    const s2 = applyStreakRecord(s1, null, "BTC", "15m", "UP", 2);
    expect(s2.current).toBe(1);
    expect(s2.voids).toBe(1);
  });
  it("history is newest-first and capped at 100", () => {
    let s = EMPTY_STREAK;
    for (let i = 0; i < 120; i++) s = applyStreakRecord(s, true, "BTC", "15m", "UP", i);
    expect(s.history).toHaveLength(100);
    expect(s.history[0].at).toBe(119);
  });
  it("winRate is wins over decided, 0 when empty", () => {
    expect(winRate(EMPTY_STREAK)).toBe(0);
    expect(winRate({ wins: 3, losses: 1 })).toBe(0.75);
  });
});

const rideBase: RideState = {
  id: "t",
  config: { asset: "BTC", direction: "UP", stake: 5, target: 30, stopLoss: 2.5, maxLegs: 4 },
  legs: [],
  status: "running",
  pot: 5,
  round: 0,
  createdAt: 0,
};

describe("ride guardrails", () => {
  it("multipliers compound as ∏1/p", () => {
    expect(legMultiplier(0.5)).toBe(2);
    const leg = { price: 0.5, multiplier: 2 } as RideLeg;
    expect(runMultiplier([leg])).toBe(2);
    expect(runMultiplier([leg, leg])).toBe(4);
  });
  it("shouldStop fires on target, stop-loss, and max legs", () => {
    expect(shouldStop({ ...rideBase, pot: 30 }).stop).toBe(true);
    expect(shouldStop({ ...rideBase, pot: 2.5 }).stop).toBe(true);
    expect(
      shouldStop({ ...rideBase, legs: [{}, {}, {}, {}] as RideLeg[] }).stop
    ).toBe(true);
    expect(shouldStop(rideBase).stop).toBe(false);
  });
});
