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
  const config = `{
  "mcpServers": {
    "tock": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${endpoint}"]
    }
  }
}`;

  return (
    <div className="min-h-screen bg-black text-white p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white text-black grid place-items-center font-black">◐</div>
        <div>
          <h1 className="text-2xl font-black">Connect your AI to Tock</h1>
          <p className="text-sm text-zinc-400">Let Claude or Cursor place your next bet. One setup, then just ask.</p>
        </div>
        <Badge className="ml-auto bg-emerald-500">Live</Badge>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle className="text-base">1 — Copy and add to your AI app</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-zinc-400">Works with Claude Desktop, Cursor, and any assistant that supports MCP. Paste this into your config file and restart the app.</p>
          <div className="relative rounded-xl bg-black border border-zinc-800 p-3">
            <pre className="font-mono text-xs overflow-auto pr-16">{config}</pre>
            <button onClick={() => copy(config, "main")} className="absolute top-2 right-2 text-xs px-3 py-1.5 rounded-lg bg-white text-black font-bold hover:bg-zinc-100">{copied === "main" ? "Copied!" : "Copy"}</button>
          </div>
          <p className="text-xs text-zinc-500">File location: <code className="bg-white/10 px-1.5 py-0.5 rounded">claude_desktop_config.json</code> (Claude) or <code className="bg-white/10 px-1.5 py-0.5 rounded">.cursor/mcp.json</code> (Cursor)</p>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle className="text-base">2 — Delegate once on Tock</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-zinc-300">Go to <a href="/" className="underline text-white">Tock</a> → connect your wallet on Shannon testnet → click <b>Delegate to Agent</b>. One approval and your agent can trade for you.</p>
          <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-zinc-400">
            Your funds stay in your wallet. You can take back permission anytime with one click.
          </div>
        </CardContent>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader><CardTitle className="text-base">3 — Ask your assistant</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="rounded-xl bg-black border border-zinc-800 p-3 font-mono text-xs space-y-1">
            <div className="text-zinc-500">Try saying:</div>
            <div className="text-white">“Place a BTC UP bet for $5 on Tock”</div>
            <div className="text-white">“Start a BTC UP ride for $5, 4 legs”</div>
            <div className="text-white">“What’s my streak on Tock?”</div>
          </div>
          <p className="text-xs text-zinc-500">Or try it right here:</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => callTool("get_live_markets")} disabled={loading} className="py-2.5 rounded-xl bg-white text-black font-bold text-xs disabled:opacity-50">See live markets</button>
            <button onClick={() => callTool("place_bet", { asset: "BTC", direction: "UP", stake: 5 })} disabled={loading} className="py-2.5 rounded-xl border border-white/20 text-white text-xs hover:bg-white/10 disabled:opacity-50">Place $5 demo</button>
            <button onClick={() => callTool("start_ride", { asset: "BTC", direction: "UP", stake: 5, maxLegs: 4 })} disabled={loading} className="py-2.5 rounded-xl border border-amber-500/30 text-amber-300 text-xs hover:bg-amber-950/30 disabled:opacity-50">Start ride</button>
          </div>
          {result && <pre className="rounded-xl bg-black border border-zinc-800 p-3 text-xs overflow-auto max-h-[260px]">{result}</pre>}
        </CardContent>
      </Card>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="pt-4 flex items-center justify-between text-xs">
          <span className="text-zinc-500">Need the direct address? <code className="bg-white/10 px-1.5 py-0.5 rounded font-mono break-all">{endpoint}</code></span>
          <button onClick={() => copy(endpoint, "ep")} className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 shrink-0 ml-2">{copied === "ep" ? "Copied!" : "Copy"}</button>
        </CardContent>
      </Card>
    </div>
  );
}
