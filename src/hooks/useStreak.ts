"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EMPTY_STREAK,
  applyStreakRecord,
  streakKey,
  winRate as calcWinRate,
  type StreakState,
  type StreakSide,
} from "@/lib/streak";

export function useStreak(chainId: number, address?: string) {
  const [state, setState] = useState<StreakState>(EMPTY_STREAK);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(streakKey(chainId, address));
      if (raw) setState(JSON.parse(raw) as StreakState);
      else setState(EMPTY_STREAK);
    } catch {
      setState(EMPTY_STREAK);
    }
  }, [chainId, address]);

  const persist = useCallback(
    (next: StreakState) => {
      setState(next);
      try {
        localStorage.setItem(streakKey(chainId, address), JSON.stringify(next));
      } catch {}
    },
    [chainId, address]
  );

  const record = useCallback(
    (won: boolean | null, asset: string, cadence: string, side: StreakSide) => {
      persist(applyStreakRecord(state, won, asset, cadence, side));
    },
    [state, persist]
  );

  const reset = useCallback(() => persist(EMPTY_STREAK), [persist]);

  const winRate = useMemo(() => calcWinRate(state), [state]);

  return { state, record, reset, winRate };
}
