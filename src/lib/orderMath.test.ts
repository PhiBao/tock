import { describe, expect, it } from "vitest";
import {
  MIN_LOT,
  snapToLot,
  clampPrice,
  upCrossPrice,
  downCrossPrice,
  previewTrade,
  secsLeft,
  isLocked,
  decodeTradeError,
  planClaims,
} from "@/lib/orderMath";

describe("snapToLot", () => {
  it("floors onto the lot grid", () => {
    expect(snapToLot(5, MIN_LOT)).toBeCloseTo(5, 9);
    expect(snapToLot(5.0009, MIN_LOT)).toBeCloseTo(5, 9);
    expect(snapToLot(0.0019, MIN_LOT)).toBeCloseTo(0.001, 9);
  });
  it("returns 0 below one lot or on bad input", () => {
    expect(snapToLot(0.0005, MIN_LOT)).toBe(0);
    expect(snapToLot(0, MIN_LOT)).toBe(0);
    expect(snapToLot(-3, MIN_LOT)).toBe(0);
    expect(snapToLot(NaN, MIN_LOT)).toBe(0);
  });
});

describe("clampPrice", () => {
  it("keeps prices on the 0.001 tick grid inside (0,1)", () => {
    expect(clampPrice(0.62344)).toBe(0.623);
    expect(clampPrice(0)).toBe(0.001);
    expect(clampPrice(1.5)).toBe(0.999);
    expect(clampPrice(NaN)).toBe(0.5);
  });
});

describe("cross prices", () => {
  it("UP pays ask + slippage, capped at 0.99", () => {
    expect(upCrossPrice(0.6, 0.6)).toBeCloseTo(0.62, 9);
    expect(upCrossPrice(0.99, 0.99)).toBe(0.99);
    expect(upCrossPrice(undefined, undefined)).toBeCloseTo(0.57, 9);
  });
  it("DOWN bids ask − slippage, extreme when bookless", () => {
    expect(downCrossPrice(0.6, 0.6)).toBeCloseTo(0.58, 9);
    expect(downCrossPrice(undefined, undefined)).toBe(0.02);
    expect(downCrossPrice(undefined, 0.6)).toBeCloseTo(0.58, 9);
  });
});

describe("previewTrade", () => {
  it("prices UP at prob and DOWN at 1 − prob", () => {
    expect(previewTrade(5, 0.6, "UP")).toMatchObject({ price: 0.6, cost: 3, payout: 5, profit: 2 });
    const down = previewTrade(5, 0.6, "DOWN")!;
    expect(down.price).toBeCloseTo(0.4, 9);
    expect(down.cost).toBeCloseTo(2, 9);
  });
  it("returns null without a price or size", () => {
    expect(previewTrade(5, undefined, "UP")).toBeNull();
    expect(previewTrade(0, 0.5, "UP")).toBeNull();
  });
});

describe("lock headroom", () => {
  it("locks at ≤30s, trades above", () => {
    expect(isLocked(1000, 975)).toBe(true); // 25s left
    expect(isLocked(1000, 969)).toBe(false); // 31s left
    expect(secsLeft(1000, 1200)).toBe(0); // past expiry floors at 0
  });
});

describe("decodeTradeError", () => {
  it("maps known reverts to human copy", () => {
    expect(decodeTradeError("ERC20InsufficientBalance()")).toMatch(/Insufficient balance/);
    expect(decodeTradeError("InvalidPrice")).toMatch(/tick grid/);
    expect(decodeTradeError("OrderAlreadyExpired")).toMatch(/just locked/);
    expect(decodeTradeError("MarketLocked")).toMatch(/just locked/);
    expect(decodeTradeError("FaucetCapExceeded")).toMatch(/cap/);
    expect(decodeTradeError("weird").startsWith("Trade failed:")).toBe(true);
  });
});

describe("planClaims", () => {
  it("voided markets redeem both sides", () => {
    expect(
      planClaims({ isVoided: true, yesBal: 5n, noBal: 3n })
    ).toEqual([
      { idx: 0, amount: 5n },
      { idx: 1, amount: 3n },
    ]);
  });
  it("resolved markets redeem the winner only", () => {
    expect(planClaims({ isResolved: true, winningOutcome: 0, yesBal: 5n, noBal: 3n })).toEqual([
      { idx: 0, amount: 5n },
    ]);
    expect(planClaims({ isResolved: true, winningOutcome: 1, yesBal: 5n, noBal: 3n })).toEqual([
      { idx: 1, amount: 3n },
    ]);
  });
  it("never plans zero-balance or unresolved claims (no wasted gas)", () => {
    expect(planClaims({ isResolved: true, winningOutcome: 0, yesBal: 0n, noBal: 3n })).toEqual([]);
    expect(planClaims({ yesBal: 5n, noBal: 3n })).toEqual([]);
  });
});
