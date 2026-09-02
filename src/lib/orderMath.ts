/* Pure order math for Tock — no SDK, no DOM, fully unit-tested.
   Mirrors the execution policy in useTrade: IOC taker that crosses the
   spread, min-lot grid, 30s lock headroom, tick-clamped prices. */

export const MIN_LOT = 0.001;
export const LOCK_HEADROOM_SEC = 30;
export const CROSS_SLIPPAGE = 0.02;

/** Floor size onto the lot grid. Returns 0 when below one lot. */
export function snapToLot(size: number, lot = MIN_LOT): number {
  if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(lot) || lot <= 0) return 0;
  return Math.floor(size / lot) * lot;
}

/** Clamp a probability price onto the 0.001 tick grid. */
export function clampPrice(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  return Math.max(0.001, Math.min(0.999, Number(p.toFixed(3))));
}

/** Limit price that crosses the book for an UP (YES) buy.
 *  Books are quoted in UP probability, so we pay ask + slippage. */
export function upCrossPrice(bestAsk?: number, mid?: number): number {
  return clampPrice(Math.min(0.99, (bestAsk ?? mid ?? 0.55) + CROSS_SLIPPAGE));
}

/** Limit price that crosses the book for a DOWN (NO) buy.
 *  The NO ask is quoted in UP terms, so we bid ask − slippage (high DOWN).
 *  With no book at all we go extreme (0.02 UP = 0.98 DOWN) — the IOC fill
 *  still executes at the real market price. */
export function downCrossPrice(bestAsk?: number, mid?: number): number {
  if (bestAsk === undefined && mid === undefined) return 0.02;
  return clampPrice(Math.max(0.01, (bestAsk ?? mid ?? 0.5) - CROSS_SLIPPAGE));
}

export type Side = "UP" | "DOWN";

export type TradePreview = {
  price: number;
  cost: number;
  payout: number;
  profit: number;
};

/** Cost / payout preview. Size is contracts; 1 contract redeems 1 unit. */
export function previewTrade(size: number, prob: number | undefined, side: Side): TradePreview | null {
  if (prob === undefined || Number.isNaN(prob) || size <= 0) return null;
  const price = side === "UP" ? prob : 1 - prob;
  const cost = size * price;
  return { price, cost, payout: size, profit: size - cost };
}

/** Seconds left in a window, floored at 0. */
export function secsLeft(expirySec: number, nowSec: number): number {
  return Math.max(0, Math.floor(expirySec - nowSec));
}

/** True when the window is too close to expiry to trade. */
export function isLocked(expirySec: number, nowSec: number, headroom = LOCK_HEADROOM_SEC): boolean {
  return secsLeft(expirySec, nowSec) <= headroom;
}

/** Human-readable decode of common SDK / on-chain trade failures. */
export function decodeTradeError(msg: string): string {
  const m = msg ?? "";
  if (m.includes("ERC20InsufficientBalance") || m.includes("InsufficientBalance")) {
    return "Insufficient balance — need tUSDC for the stake plus STT for gas. Hit the faucet below.";
  }
  if (m.includes("InvalidPrice")) {
    return "Price moved off the tick grid (InvalidPrice). The book shifted — try again.";
  }
  if (m.includes("OrderAlreadyExpired") || m.includes("MarketLocked")) {
    return "Window just locked — your order expired. The next window is already open.";
  }
  if (m.includes("FaucetCapExceeded")) {
    return "Faucet cap: 10k per call. Try again after a block.";
  }
  return `Trade failed: ${m.slice(0, 300)}`;
}

export type ClaimCandidate = { idx: 0 | 1; amount: bigint };

/** Which outcome balances are redeemable, given settlement state.
 *  Voided → both sides at 0.5. Resolved → winner only. Unresolved → none.
 *  (Redeeming a losing side pays 0 — never spend gas on it.) */
export function planClaims(o: {
  isVoided?: boolean;
  isResolved?: boolean;
  winningOutcome?: number | null;
  yesBal?: bigint;
  noBal?: bigint;
}): ClaimCandidate[] {
  const out: ClaimCandidate[] = [];
  const yes = o.yesBal ?? BigInt(0);
  const no = o.noBal ?? BigInt(0);
  if (o.isVoided) {
    if (yes > BigInt(0)) out.push({ idx: 0, amount: yes });
    if (no > BigInt(0)) out.push({ idx: 1, amount: no });
    return out;
  }
  if (o.isResolved && (o.winningOutcome === 0 || o.winningOutcome === 1)) {
    const bal = o.winningOutcome === 0 ? yes : no;
    if (bal > BigInt(0)) out.push({ idx: o.winningOutcome as 0 | 1, amount: bal });
  }
  return out;
}
