"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function McpPage() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const callTool = async (name: string, args: Record<string, unknown> = {}) => {
    setLoading(true);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
      });
      const j = await res.json();
      setResult(JSON.stringify(j, null, 2));
    } catch (e) {
      setResult(String(e));
    } finally {
      setLoading(false);
    }
  };

  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white text-black grid place-items-center font-black">◐</div>
        <div>
          <h1 className="text-2xl font-black">Tock MCP</h1>
          <p className="text-sm text-zinc-400">Agent-native — Somnia MCP + reactivity. One delegate, then agent trades with 0 popups.</p>
        </div>
        <Badge className="ml-auto bg-emerald-500">Live on Shannon 50312</Badge>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle className="text-base">HTTP Endpoint (works now, not just on paper)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl bg-black border border-zinc-800 p-3 font-mono text-xs break-all">{endpoint}</div>
          <div className="grid sm:grid-cols-2 gap-2">
            <button onClick={() => callTool("get_live_markets")} disabled={loading} className="py-2.5 rounded-xl bg-white text-black font-bold text-sm disabled:opacity-50">Try get_live_markets</button>
            <button onClick={() => callTool("place_bet", { asset: "BTC", direction: "UP", stake: 5 })} disabled={loading} className="py-2.5 rounded-xl border border-white/20 text-white text-sm hover:bg-white/10 disabled:opacity-50">Try place_bet (sim)</button>
          </div>
          {result && <pre className="rounded-xl bg-black border border-zinc-800 p-3 text-xs overflow-auto max-h-[300px]">{result}</pre>}
          <div className="text-xs text-zinc-500 leading-relaxed">
            <b>Claude Desktop (stdio):</b> add to <code className="bg-white/10 px-1 rounded">claude_desktop_config.json</code>:
            <pre className="mt-1 rounded bg-black border border-zinc-800 p-2 font-mono text-[11px] overflow-auto">{`{
  "mcpServers": {
    "tock": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "env": { "SOMNIA_RPC": "https://dream-rpc.somnia.network" }
    }
  }
}`}</pre>
            <b>Cursor / Windsurf:</b> same config. <b>HTTP (remote):</b> POST to <code className="bg-white/10 px-1 rounded">{endpoint}</code> with <code>{"{"}jsonrpc:"2.0", method:"tools/call", params:{"{"}name, arguments{"}"}{"}"}</code>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle className="text-base">How delegate makes it 1-click</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-300 leading-relaxed">
          <ol className="list-decimal pl-5 space-y-1">
            <li><b>Connect</b> on Shannon testnet → <b>Delegate to Agent</b> (one tx: <code className="bg-white/10 px-1 rounded">approve(tUSDC, agent, max)</code> + <code className="bg-white/10 px-1 rounded">setOperator</code> for ERC6909).</li>
            <li>Agent <code className="bg-white/10 px-1 rounded">0x111…111</code> is now allowed to pull your tUSDC and place via <code className="bg-white/10 px-1 rounded">placeOrderFor(yourAddress, …)</code> — Somnia’s <code>OperatorPermissionsRegistry</code> (spot) pattern, adapted for binary.</li>
            <li>Next bets: click <b>UP/DOWN</b> or ask Claude <i>“place BTC UP 5 via Tock”</i> → agent calls <code className="bg-white/10 px-1 rounded">place_bet</code> → <b>0 wallet popups</b> (agent pays gas, pulls your collateral, winnings to you). Toggle <b>Trade alongside me</b> in the Agent panel to have it mirror your manual trades 3s later.</li>
            <li>Revoke anytime: same button → <code className="bg-white/10 px-1 rounded">approve(0)</code> / <code className="bg-white/10 px-1 rounded">approved:false</code>.</li>
          </ol>
          <div className="rounded-xl bg-amber-950/30 border border-amber-900/30 p-2.5 text-xs text-amber-200">
            Testnet demo uses a shared funded agent key (set <code>TOCK_AGENT_PRIVATE_KEY</code> in Vercel env to make <code>place_bet</code> live instead of simulated). Your main wallet never leaves your custody.
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle className="text-base">Try the agent alongside you</CardTitle></CardHeader>
        <CardContent className="text-sm text-zinc-400">
          On the main Tock page, enable <b>AgentPanel → Trade alongside me</b> after delegating. Place a manual bet → agent mirrors it in 3s (shown in log). For MCP, ask your client: <i>“Use Tock MCP to start a BTC UP ride of 5 tUSDC ×4”</i>.
        </CardContent>
      </Card>
    </div>
  );
}
