"use client";

import { useStreak } from "@/hooks/useStreak";

export function StreakBar({ chainId, address }: { chainId: number; address?: string }) {
  const { state, winRate } = useStreak(chainId, address);
  return (
    <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-4 flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-400 grid place-items-center font-black text-xl text-black">🔥{state.current}</div>
      <div className="flex-1">
        <div className="text-sm font-bold text-white">Streak {state.current} · Best {state.best}</div>
        <div className="text-xs text-zinc-400">
          {state.wins}W – {state.losses}L {state.voids ? `· ${state.voids} void` : ""} · {Math.round(winRate * 100)}% win rate
        </div>
        <div className="mt-2 flex gap-1">
          {state.history.slice(0, 16).map((h, i) => (
            <span
              key={i}
              className={`w-2.5 h-6 rounded-full ${h.won === true ? "bg-emerald-500" : h.won === false ? "bg-red-500" : "bg-zinc-700"}`}
              title={`${h.asset} ${h.cadence} ${h.side} ${h.won === true ? "W" : h.won === false ? "L" : "void"}`}
            />
          ))}
          {state.history.length === 0 && <span className="text-xs text-zinc-500">No calls yet — your first call starts the streak.</span>}
        </div>
      </div>
    </div>
  );
}
