/* Pure streak transition — extracted from useStreak so the
   win/loss/void accounting is unit-testable. */

export type StreakSide = "UP" | "DOWN";

export type StreakEntry = {
  at: number;
  won: boolean | null;
  asset: string;
  cadence: string;
  side: StreakSide;
};

export type StreakState = {
  current: number;
  best: number;
  wins: number;
  losses: number;
  voids: number;
  history: StreakEntry[];
};

export const EMPTY_STREAK: StreakState = {
  current: 0,
  best: 0,
  wins: 0,
  losses: 0,
  voids: 0,
  history: [],
};

/** Win increments (and may set best); loss resets; void leaves the run intact. */
export function applyStreakRecord(
  prev: StreakState,
  won: boolean | null,
  asset: string,
  cadence: string,
  side: StreakSide,
  at = Date.now()
): StreakState {
  return {
    current: won === true ? prev.current + 1 : won === false ? 0 : prev.current,
    best: won === true ? Math.max(prev.best, prev.current + 1) : prev.best,
    wins: prev.wins + (won === true ? 1 : 0),
    losses: prev.losses + (won === false ? 1 : 0),
    voids: prev.voids + (won === null ? 1 : 0),
    history: [{ at, won, asset, cadence, side }, ...prev.history].slice(0, 100),
  };
}

export function winRate(s: Pick<StreakState, "wins" | "losses">): number {
  const total = s.wins + s.losses;
  return total ? s.wins / total : 0;
}

export function streakKey(chainId: number, address?: string): string {
  return `tock:streak:${chainId}:${(address ?? "anon").toLowerCase()}`;
}
