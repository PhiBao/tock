"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type StreakState = {
  current: number;
  best: number;
  wins: number;
  losses: number;
  voids: number;
  history: Array<{ at: number; won: boolean | null; asset: string; cadence: string; side: "UP" | "DOWN" }>;
};

const keyFor = (chainId: number, address?: string) => `tock:streak:${chainId}:${(address ?? "anon").toLowerCase()}`;

export function useStreak(chainId: number, address?: string) {
  const [state, setState] = useState<StreakState>({ current: 0, best: 0, wins: 0, losses: 0, voids: 0, history: [] });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyFor(chainId, address));
      if (raw) setState(JSON.parse(raw));
      else setState({ current: 0, best: 0, wins: 0, losses: 0, voids: 0, history: [] });
    } catch {
      setState({ current: 0, best: 0, wins: 0, losses: 0, voids: 0, history: [] });
    }
  }, [chainId, address]);

  const persist = useCallback(
    (next: StreakState) => {
      setState(next);
      try {
        localStorage.setItem(keyFor(chainId, address), JSON.stringify(next));
      } catch {}
    },
    [chainId, address]
  );

  const record = useCallback(
    (won: boolean | null, asset: string, cadence: string, side: "UP" | "DOWN") => {
      const next: StreakState = {
        current: won === true ? state.current + 1 : won === false ? 0 : state.current,
        best: won === true ? Math.max(state.best, state.current + 1) : state.best,
        wins: state.wins + (won === true ? 1 : 0),
        losses: state.losses + (won === false ? 1 : 0),
        voids: state.voids + (won === null ? 1 : 0),
        history: [{ at: Date.now(), won, asset, cadence, side }, ...state.history].slice(0, 100),
      };
      persist(next);
    },
    [state, persist]
  );

  const reset = useCallback(() => persist({ current: 0, best: 0, wins: 0, losses: 0, voids: 0, history: [] }), [persist]);

  const winRate = useMemo(() => {
    const total = state.wins + state.losses;
    return total ? state.wins / total : 0;
  }, [state.wins, state.losses]);

  return { state, record, reset, winRate };
}
