export type RideConfig = {
  asset: "BTC" | "ETH";
  direction: "UP" | "DOWN";
  stake: number; // tUSDC
  target?: number; // cash-out target, e.g. 20 tUSDC
  stopLoss?: number; // floor, e.g. 5 tUSDC
  maxLegs: number; // 2..8
};

export type RideLeg = {
  marketId: string;
  expiry: number;
  side: "UP" | "DOWN";
  price: number; // prob
  quantity: number;
  escrow: number;
  txHash?: string;
  status: "open" | "won" | "lost" | "void" | "pending";
  payout?: number;
  multiplier?: number;
};

export type RideState = {
  id: string;
  config: RideConfig;
  legs: RideLeg[];
  status: "idle" | "running" | "paused" | "won" | "lost" | "void" | "failed";
  pot: number; // current pot to roll
  round: number;
  createdAt: number;
};

export function legMultiplier(price: number) {
  return 1 / price;
}
export function runMultiplier(legs: RideLeg[]) {
  return legs.reduce((acc, l) => acc * (l.multiplier ?? 1 / (l.price || 0.5)), 1);
}
export function shouldStop(state: RideState): { stop: boolean; reason: string } {
  const { target, stopLoss, maxLegs } = state.config;
  if (target && state.pot >= target) return { stop: true, reason: `Target hit: ${state.pot.toFixed(2)} ≥ ${target}` };
  if (stopLoss && state.pot <= stopLoss) return { stop: true, reason: `Stop-loss: ${state.pot.toFixed(2)} ≤ ${stopLoss}` };
  if (state.legs.length >= maxLegs) return { stop: true, reason: `Max legs ${maxLegs} reached` };
  return { stop: false, reason: "" };
}
