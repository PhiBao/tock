"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { Confetti } from "@/components/magicui/confetti";
import { RideConfig, RideState } from "@/lib/ride";

export function RidePanel({
  chainId,
  onStartRide,
  ride,
  onStop,
}: {
  chainId: number;
  onStartRide: (c: RideConfig) => void;
  ride: RideState | null;
  onStop: () => void;
}) {
  const [asset, setAsset] = useState<"BTC" | "ETH">("BTC");
  const [dir, setDir] = useState<"UP" | "DOWN">("UP");
  const [stake, setStake] = useState(5);
  const [maxLegs, setMaxLegs] = useState(4);
  const [target, setTarget] = useState(30);
  const [confettiFire, setConfettiFire] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (ride?.status === "won") {
      setConfettiFire(true);
      const t = setTimeout(() => setConfettiFire(false), 1500);
      return () => clearTimeout(t);
    }
  }, [ride?.status]);

  const isRunning = ride?.status === "running";

  return (
    <Card className="overflow-hidden border-zinc-800 bg-zinc-900/70 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Ride mode
            <Badge variant="secondary" className="bg-amber-400 text-black">AUTO-ROLL</Badge>
          </CardTitle>
          <Badge variant="outline" className="border-white/10 text-zinc-400">
            {chainId === 50312 ? "Shannon" : "Mainnet"} · {ride ? `${ride.legs.length}/${ride.config.maxLegs}` : `—`}
          </Badge>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Bet once, let winnings <em>ride</em>. Guardrails stop you before tilt — inspired by <code>LET_IT_RIDE</code> + <code>Runs</code> (<code>∏1/p</code>).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isRunning ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(["BTC", "ETH"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAsset(a)}
                  className={`py-2.5 rounded-xl font-bold border ${asset === a ? "bg-white text-black border-white" : "bg-zinc-800 text-zinc-300 border-zinc-700"}`}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["UP", "DOWN"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDir(d)}
                  className={`py-2.5 rounded-xl font-bold ${d === "UP" ? (dir === d ? "bg-emerald-500 text-white" : "bg-zinc-800 text-zinc-400") : dir === d ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400"}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs"><span className="text-zinc-400">Stake</span><span className="font-mono font-bold"><NumberTicker value={stake} decimalPlaces={2} prefix="$" /></span></div>
                <Slider value={[stake]} min={1} max={25} step={1} onValueChange={(v) => setStake(Array.isArray(v) ? (v as number[])[0] : (v as number))} />
              </div>
              <div>
                <div className="flex justify-between text-xs"><span className="text-zinc-400">Max legs (streak parlay)</span><span className="font-mono">{maxLegs}</span></div>
                <Slider value={[maxLegs]} min={2} max={8} step={1} onValueChange={(v) => setMaxLegs(Array.isArray(v) ? (v as number[])[0] : (v as number))} />
                <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-2.5 text-xs leading-relaxed">
                  <div className="font-bold text-white">New here? Win all {maxLegs} rounds and <NumberTicker value={stake * Math.pow(1.8, maxLegs)} decimalPlaces={0} prefix="$" className="text-emerald-400" /> <span className="text-zinc-400">from ${stake}</span></div>
                  <div className="text-[11px] text-zinc-400 mt-1">Each win rolls your $ to the next 5-min window. Lose once = ride ends. Real odds change live — shown as <span className="font-mono bg-white/10 px-1 rounded">1/p</span> per leg. Example: 4 wins at fair odds ≈ 14× after fees.</div>
                </div>
              </div>
              <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-zinc-400 underline">
                {showAdvanced ? "Hide guardrails" : "Show guardrails (cash-out / stop-loss)"}
              </button>
              {showAdvanced && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-zinc-400">Cash-out target</span><span className="font-mono">${target}</span></div>
                  <Slider value={[target]} min={10} max={200} step={5} onValueChange={(v) => setTarget(Array.isArray(v) ? (v as number[])[0] : (v as number))} />
                  <p className="text-[11px] text-zinc-500">Stops when pot ≥ target. `Runs` showed 10.9× on one 1m leg — guardrails lock it in.</p>
                </motion.div>
              )}
            </div>
            <button
              onClick={() => onStartRide({ asset, direction: dir, stake, maxLegs, target, stopLoss: stake * 0.5 })}
              className="w-full py-3.5 rounded-2xl bg-white text-black font-black hover:bg-zinc-100 flex items-center justify-center gap-2"
            >
              Start Ride — {asset} {dir} {maxLegs} legs
            </button>
            <p className="text-[11px] text-zinc-500 text-center">Demo uses your connected wallet (same batch-approve as manual). Prod would use a capped ride wallet / session key — see `LET_IT_RIDE` pattern.</p>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">
                Riding {ride.config.asset} {ride.config.direction} · pot <NumberTicker value={ride.pot} decimalPlaces={2} prefix="$" />
              </span>
              <Badge className="bg-emerald-500 animate-pulse">LIVE</Badge>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: ride.config.maxLegs }).map((_, i) => {
                const leg = ride.legs[i];
                const state = !leg ? "pending" : leg.status === "won" ? "won" : leg.status === "lost" ? "lost" : "open";
                return (
                  <motion.div
                    key={i}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`flex-1 h-8 rounded-lg grid place-items-center text-xs font-bold border ${state === "won" ? "bg-emerald-500 text-white border-emerald-400" : state === "lost" ? "bg-red-500 text-white border-red-400" : state === "open" ? "bg-amber-400 text-black border-amber-300 animate-pulse" : "bg-zinc-800 text-zinc-500 border-zinc-700"}`}
                  >
                    {leg ? `${(1 / leg.price).toFixed(1)}×` : `${i + 1}`}
                  </motion.div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-zinc-800 p-2"><div className="text-zinc-500">Legs</div><div className="font-mono font-bold">{ride.legs.filter((l) => l.status === "won").length}/{ride.config.maxLegs}</div></div>
              <div className="rounded-xl bg-zinc-800 p-2"><div className="text-zinc-500">Pot</div><div className="font-mono font-bold">${ride.pot.toFixed(2)}</div></div>
              <div className="rounded-xl bg-zinc-800 p-2"><div className="text-zinc-500">Run ×</div><div className="font-mono font-bold">{ride.legs.reduce((a, l) => a * (l.multiplier || 1), 1).toFixed(2)}×</div></div>
            </div>
            <AnimatePresence>
              {ride.status === "won" && <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-emerald-500 text-white p-3 text-sm font-bold text-center">Ride WON — claimed!</motion.div>}
              {ride.status === "lost" && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-red-500 text-white p-3 text-sm font-bold text-center">Ride lost — stopped at leg {ride.legs.length}</motion.div>}
            </AnimatePresence>
            <button onClick={onStop} className="w-full py-2.5 rounded-xl border border-white/20 text-white hover:bg-white/10 text-sm font-semibold">
              Stop Ride
            </button>
            <Confetti fire={confettiFire} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
