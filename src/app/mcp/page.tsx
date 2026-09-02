"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function McpPage() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

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

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const endpoint = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "https://tock-delta.vercel.app/api/mcp";
  const stdioConfig = `{
  "mcpServers": {
    "tock": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${endpoint}"]
    }
  }
}`;
  const httpConfig = `{
  "mcpServers": {
    "tock": {
      "url": "${endpoint}",
      "headers": {}
    }
  }
}`;
  const localConfig = `{
  "mcpServers": {
    "tock": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "cwd": "/path/to/tock",
      "env": { "SOMNIA_RPC": "https://dream-rpc.somnia.network" }
    }
  }
}`;

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white text-black grid place-items-center font-black">◐</div>
        <div>
          <h1 className="text-2xl font-black">Tock MCP</h1>
          <p className="text-sm text-zinc-400">Agent-native — one delegate, then 0 popups. Works with Claude, Cursor, or curl.</p>
        </div>
        <Badge className="ml-auto bg-emerald-500">Live on Shannon 50312</Badge>
      </div>

      <Card className="bg-amber-950/30 border-amber-900/50">
        <CardContent className="pt-4 text-xs leading-relaxed text-amber-200">
          <b>Why your copy didn’t trade:</b> The old JSON was <code className="bg-black/30 px-1 rounded">stdio</code> only (<code>npx tsx mcp/server.ts</code> needs the repo locally + a private key). For hackathon demo you want <b>HTTP</b> — no local files, no key. Copy the <b>HTTP</b> config below. <code>place_bet</code> is live after you click <b>Delegate to Agent</b> on the main page (one tx), otherwise it simulates and tells you why.
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle className="text-base flex items-center gap-2">HTTP Endpoint <Badge variant="secondary" className="bg-emerald-500 text-black">Works now</Badge></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl bg-black border border-zinc-800 p-3 font-mono text-xs break-all flex items-center justify-between gap-2">
            <span>{endpoint}</span>
            <button onClick={() => copy(endpoint, "ep")} className="text-xs px-2 py-1 rounded bg-white text-black font-bold shrink-0">{copied === "ep" ? "Copied!" : "Copy"}</button>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <button onClick={() => callTool("get_live_markets")} disabled={loading} className="py-2.5 rounded-xl bg-white text-black font-bold text-sm disabled:opacity-50">Try get_live_markets</button>
            <button onClick={() => callTool("place_bet", { asset: "BTC", direction: "UP", stake: 5 })} disabled={loading} className="py-2.5 rounded-xl border border-white/20 text-white text-sm hover:bg-white/10 disabled:opacity-50">Try place_bet 5</button>
            <button onClick={() => callTool("start_ride", { asset: "BTC", direction: "UP", stake: 5, maxLegs: 4 })} disabled={loading} className="py-2.5 rounded-xl border border-amber-500/30 text-amber-300 text-sm hover:bg-amber-950/30 disabled:opacity-50">Try start_ride</button>
          </div>
          {result && <pre className="rounded-xl bg-black border border-zinc-800 p-3 text-xs overflow-auto max-h-[300px]">{result}</pre>}
          <div className="rounded-xl bg-black border border-zinc-800 p-2 text-xs font-mono overflow-auto">
            <div className="text-zinc-500"># curl — no MCP client needed</div>
            curl -X POST {endpoint} -H &quot;Content-Type: application/json&quot; -d &apos;{"{"}&quot;jsonrpc&quot;:&quot;2.0&quot;,&quot;method&quot;:&quot;tools/call&quot;,&quot;params&quot;:{"{"}&quot;name&quot;:&quot;get_live_markets&quot;{"}"}{"}"}&apos;
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle className="text-base">Claude Desktop / Cursor — copy this (HTTP, 1-click)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-zinc-400">No repo needed. Uses <code className="bg-white/10 px-1 rounded">mcp-remote</code> to talk to the live endpoint. Paste into <code className="bg-white/10 px-1 rounded">claude_desktop_config.json</code> → restart Claude → ask “place BTC UP 5 via Tock”.</p>
          <div className="relative rounded-xl bg-black border border-zinc-800 p-3">
            <pre className="font-mono text-[11px] overflow-auto pr-12">{stdioConfig}</pre>
            <button onClick={() => copy(stdioConfig, "stdio")} className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-white text-black font-bold">{copied === "stdio" ? "Copied!" : "Copy"}</button>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-zinc-400 hover:text-white">Other clients (direct HTTP or local stdio)</summary>
            <div className="mt-2 space-y-2">
              <div>
                <div className="font-bold text-zinc-300">Direct HTTP (new Claude, MCP Inspector):</div>
                <div className="relative mt-1 rounded bg-black border border-zinc-800 p-2">
                  <pre className="font-mono text-[11px] overflow-auto pr-12">{httpConfig}</pre>
                  <button onClick={() => copy(httpConfig, "http")} className="absolute top-1 right-1 text-xs px-2 py-1 rounded bg-white text-black font-bold">{copied === "http" ? "Copied!" : "Copy"}</button>
                </div>
              </div>
              <div>
                <div className="font-bold text-zinc-300">Local stdio (clone repo, for devs):</div>
                <div className="relative mt-1 rounded bg-black border border-zinc-800 p-2">
                  <pre className="font-mono text-[11px] overflow-auto pr-12">{localConfig}</pre>
                  <button onClick={() => copy(localConfig, "local")} className="absolute top-1 right-1 text-xs px-2 py-1 rounded bg-white text-black font-bold">{copied === "local" ? "Copied!" : "Copy"}</button>
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">Needs <code>git clone https://github.com/PhiBao/tock && pnpm install</code> and <code>TOCK_AGENT_PRIVATE_KEY</code> for live trades.</div>
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle className="text-base">How delegate makes it 1-click</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-zinc-300 leading-relaxed">
          <ol className="list-decimal pl-5 space-y-1">
            <li><b>Connect</b> on Shannon → <b>Delegate to Agent</b> (one tx: <code className="bg-white/10 px-1 rounded">approve(tUSDC, 0x111…111, max)</code>).</li>
            <li>Ask Claude: <i>“place BTC UP 5 via Tock”</i> → MCP calls <code className="bg-white/10 px-1 rounded">place_bet</code> → if delegated, it executes via agent key with your funds; if not, it returns <i>“Delegate first”</i> and simulates.</li>
            <li>Toggle <b>Trade alongside me</b> on the main page → every manual bet you place, agent mirrors 3s later with 0 popups.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
