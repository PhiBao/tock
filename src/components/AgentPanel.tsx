"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AgentPanel({ isDelegated, onToggle, lastHumanTrade }: { isDelegated: boolean; onToggle: () => void; lastHumanTrade?: { asset: string; direction: "UP" | "DOWN"; stake: number; at: number } | null }) {
  const [enabled, setEnabled] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled || !lastHumanTrade) return;
    // Agent trades alongside human 3s later, opposite or same? For demo, same direction with 0.5x stake
    const t = setTimeout(() => {
      const msg = `🤖 Agent: mirroring ${lastHumanTrade.asset} ${lastHumanTrade.direction} ${(lastHumanTrade.stake * 0.5).toFixed(1)} — would place via placeOrderFor after delegate`;
      setLog((l) => [msg, ...l].slice(0, 5));
    }, 3000);
    return () => clearTimeout(t);
  }, [enabled, lastHumanTrade]);

  return (
    <Card className="border-zinc-800 bg-zinc-900/70 backdrop-blur">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
            Tock Agent
            <Badge variant={isDelegated ? "default" : "outline"} className={isDelegated ? "bg-emerald-500" : "border-amber-500/30 text-amber-400"}>
              {isDelegated ? "Delegated" : "Not delegated"}
            </Badge>
          </CardTitle>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={!isDelegated} className="rounded" />
            <span className={isDelegated ? "text-zinc-300" : "text-zinc-500"}>Trade alongside me</span>
          </label>
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          MCP: <code className="bg-white/10 px-1 rounded">get_live_markets</code> · <code className="bg-white/10 px-1 rounded">place_bet</code> · <code className="bg-white/10 px-1 rounded">start_ride</code>. Agent runs via <code>mcp/server.ts</code> (stdio) and can call <code>placeOrderFor</code> after you delegate — one click, then 0 popups.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {!isDelegated ? (
          <div className="rounded-xl bg-amber-950/30 border border-amber-900/30 p-3 text-xs text-amber-200">
            Click <b>Delegate to Agent</b> above — one tx approves the agent’s session key. After that, the agent can trade for you without wallet popups (Somnia’s <code>OperatorPermissionsRegistry</code>).
          </div>
        ) : enabled ? (
          <div className="space-y-1.5">
            {log.length === 0 ? (
              <div className="text-xs text-zinc-500">Agent is watching… place a manual bet and it will mirror in 3s.</div>
            ) : (
              log.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="text-xs font-mono bg-black/30 border border-white/5 rounded-lg px-2.5 py-1.5">
                  {m}
                </motion.div>
              ))
            )}
          </div>
        ) : (
          <div className="text-xs text-zinc-500">Enable “Trade alongside me” to let the agent mirror your next bet. Needs delegation first.</div>
        )}
        <div className="flex gap-2">
          <button onClick={onToggle} className="flex-1 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-semibold hover:bg-zinc-700">
            {isDelegated ? "Revoke delegate" : "Delegate to Agent (one-time)"}
          </button>
          <a
            href="/mcp"
            className="px-3 py-2 rounded-xl border border-white/10 text-xs hover:bg-white/5 text-center"
            title="Open MCP guide — stdio for Claude Desktop + HTTP for web"
          >
            MCP Guide ↗
          </a>
        </div>
        <div className="text-[11px] text-zinc-500 leading-relaxed">
          After delegate, the agent runs <code className="bg-white/10 px-1 rounded">npx tsx mcp/server.ts</code> and can call <code>place_bet</code> alongside you — no extra wallet popups. See <code>mcp/server.ts</code> tools.
        </div>
        <AnimatePresence>
          {isDelegated && enabled && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0 }} className="text-[11px] text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 rounded-lg px-2.5 py-2">
              Agent is live — check <code>mcp/server.ts</code> logs. Try <code>npx tsx mcp/server.ts</code> locally, or let the Vercel cron (prod) run it.
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
