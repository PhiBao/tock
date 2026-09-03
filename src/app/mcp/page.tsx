"use client";
import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { ToolResult } from "@/components/ToolResult";
import { useBalances } from "@/hooks/useBalances";
import { useAccount, usePublicClient } from "wagmi";

export default function McpPage() {
  const [result, setResult] = useState<unknown>(null);
  const [lastTool, setLastTool] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const balances = useBalances(chainId ?? 50312, address, publicClient);

  const callTool = async (name: string, args: Record<string, unknown> = {}) => {
    setLoading(true);
    setLastTool(name);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
      });
      setResult(await res.json());
    } catch (e) {
      setResult({ error: { message: String(e) } });
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

  const steps = [
    {
      n: "1",
      title: "Add Tock to your AI app",
      body: "Works with Claude Desktop, Cursor, and any MCP-capable assistant. Paste this into your config file and restart the app.",
    },
    {
      n: "2",
      title: "Delegate once on Tock",
      body: "Trading needs your money, not ours — one approval lets the agent place orders against your wallet. Revoke anytime.",
    },
    {
      n: "3",
      title: "Ask your assistant",
      body: "It reads live windows, crosses the spread IOC, and rolls rides — the same execution policy as the UI.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <SiteHeader chainId={chainId ?? 50312} balances={balances} isConnected={isConnected} />
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gold text-xl font-black text-black">◐</div>
          <div>
            <p className="text-[11px] font-bold tracking-[0.24em] text-gold">AGENT SURFACE · MCP</p>
            <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Point your AI at Tock</h1>
            <p className="mt-1 text-sm text-zinc-400">Let Claude or Cursor read windows and place your next call. One setup, then just ask.</p>
          </div>
          <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300 sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
        </div>

        <div className="grid gap-3">
          {steps.map((s) => (
            <div key={s.n} className="rounded-3xl border border-white/[0.07] bg-panel p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold font-mono text-xs font-black text-black">
                  {s.n}
                </span>
                <h2 className="font-display text-base font-bold">{s.title}</h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.body}</p>
              {s.n === "1" && (
                <>
                  <div className="relative mt-3 rounded-2xl border border-white/10 bg-black/50 p-3">
                    <pre className="overflow-auto pr-16 font-mono text-xs leading-relaxed text-zinc-200">{config}</pre>
                    <button
                      onClick={() => copy(config, "main")}
                      className="absolute right-2 top-2 rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-black transition hover:bg-amber-300"
                    >
                      {copied === "main" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-zinc-600">
                    File: <code className="rounded bg-white/10 px-1.5 py-0.5">claude_desktop_config.json</code> (Claude) or{" "}
                    <code className="rounded bg-white/10 px-1.5 py-0.5">.cursor/mcp.json</code> (Cursor)
                  </p>
                </>
              )}
              {s.n === "2" && (
                <p className="mt-2 text-sm text-zinc-300">
                  Go to <Link href="/" className="font-semibold text-gold underline underline-offset-2">Tock</Link> → connect on
                  Shannon testnet → <b>Give agent permission</b>. Funds stay in your wallet; take it back in one click.
                </p>
              )}
              {s.n === "3" && (
                <>
                  <div className="mt-3 space-y-1 rounded-2xl border border-white/10 bg-black/50 p-3 font-mono text-xs">
                    <div className="text-zinc-600">Try saying:</div>
                    <div className="text-zinc-100">“Place a BTC UP bet for $5 on Tock”</div>
                    <div className="text-zinc-100">“Start a BTC UP ride for $5, 4 legs”</div>
                    <div className="text-zinc-100">“What&apos;s my streak on Tock?”</div>
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">Or try it right here:</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => callTool("get_live_markets")}
                      disabled={loading}
                      className="rounded-xl bg-white py-2.5 text-xs font-bold text-black transition hover:bg-zinc-200 disabled:opacity-50"
                    >
                      Live markets
                    </button>
                    <button
                      onClick={() => callTool("place_bet", { asset: "BTC", direction: "UP", stake: 5 })}
                      disabled={loading}
                      className="rounded-xl border border-white/15 py-2.5 text-xs font-semibold text-white transition hover:bg-white/5 disabled:opacity-50"
                    >
                      $5 demo bet
                    </button>
                    <button
                      onClick={() => callTool("start_ride", { asset: "BTC", direction: "UP", stake: 5, maxLegs: 4 })}
                      disabled={loading}
                      className="rounded-xl border border-gold/30 py-2.5 text-xs font-bold text-gold transition hover:bg-gold/10 disabled:opacity-50"
                    >
                      Start ride
                    </button>
                  </div>
                  {loading && <p className="mt-2 font-mono text-xs text-zinc-500">Calling tool…</p>}
                  {result !== null && !loading && (
                    <div className="mt-2">
                      <ToolResult tool={lastTool} data={result} />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/[0.07] bg-panel px-4 py-3 text-xs">
          <span className="min-w-0 truncate text-zinc-500">
            Endpoint <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono">{endpoint}</code>
          </span>
          <button
            onClick={() => copy(endpoint, "ep")}
            className="ml-2 shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 font-semibold text-zinc-200 transition hover:bg-white/10"
          >
            {copied === "ep" ? "Copied!" : "Copy"}
          </button>
        </div>
      </main>
    </div>
  );
}
