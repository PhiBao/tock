"use client";

import { motion } from "framer-motion";
import { useStreak } from "@/hooks/useStreak";

export function StreakBar({ chainId, address }: { chainId: number; address?: string }) {
  const { state, winRate } = useStreak(chainId, address);
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-white/[0.07] bg-panel p-4">
      <motion.div
        key={state.current}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}
        className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gold font-mono text-xl font-black tabular-nums text-black"
        title={`${state.current} in a row`}
      >
        {state.current}
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-white">
          Streak {state.current} <span className="font-medium text-zinc-500">· Best {state.best}</span>
        </div>
        <div className="mt-0.5 font-mono text-xs tabular-nums text-zinc-500">
          {state.wins}W–{state.losses}L{state.voids ? ` · ${state.voids} void` : ""} · {Math.round(winRate * 100)}%
        </div>
        <div className="mt-2 flex gap-1" aria-label="Recent results">
          {state.history.slice(0, 16).map((h, i) => (
            <span
              key={`${h.at}-${i}`}
              className={`h-6 w-2.5 rounded-full ${
                h.won === true ? "bg-emerald-400" : h.won === false ? "bg-red-400" : "bg-zinc-700"
              }`}
              title={`${h.asset} ${h.cadence} ${h.side} ${h.won === true ? "W" : h.won === false ? "L" : "void"}`}
            />
          ))}
          {state.history.length === 0 && (
            <span className="text-xs text-zinc-600">No calls yet — your first call starts the streak.</span>
          )}
        </div>
      </div>
    </div>
  );
}
