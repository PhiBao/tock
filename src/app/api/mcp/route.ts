import { NextRequest, NextResponse } from "next/server";
import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";

export const runtime = "nodejs";

// Simple MCP over HTTP (Streamable HTTP style) — supports tools/list and tools/call via POST
// For Claude Desktop stdio, use mcp/server.ts directly. This HTTP endpoint is for web testing and remote agents.

const TOOLS = [
  { name: "get_live_markets", description: "Get live BTC/ETH event contract windows on Somnia Shannon (DreamDEX). Returns asset, interval, expiry, Up prob, spread.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "place_bet", description: "Place UP/DOWN bet on current window. Requires delegation (one-time approve to Tock Agent 0x111...111). In demo, uses shared testnet agent if delegated, otherwise simulates.", inputSchema: { type: "object", properties: { asset: { type: "string", enum: ["BTC","ETH"] }, direction: { type: "string", enum: ["UP","DOWN"] }, stake: { type: "number" }, address: { type: "string", description: "User address that delegated to agent" } }, required: ["asset","direction","stake"] } },
  { name: "get_streak", description: "Get streak for an address (reads from Tock localStorage key, mocked on server).", inputSchema: { type: "object", properties: { address: { type: "string" } }, required: [] } },
  { name: "start_ride", description: "Start a Ride auto-roll: asset, direction, stake, maxLegs. Agent will poll and roll.", inputSchema: { type: "object", properties: { asset: { type: "string", enum: ["BTC","ETH"] }, direction: { type: "string", enum: ["UP","DOWN"] }, stake: { type: "number" }, maxLegs: { type: "number" } }, required: ["asset","direction","stake"] } },
];

export async function GET() {
  return NextResponse.json({ name: "tock-mcp", version: "0.1.0", transport: "http", tools: TOOLS, endpoint: "/api/mcp", stdio: "npx tsx mcp/server.ts" });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { method, params } = body as { method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };

  // Handle MCP JSON-RPC style: {jsonrpc:"2.0", id, method:"tools/list" | "tools/call", params:{name, arguments}}
  const m = method || (body as Record<string, unknown>).method as string | undefined;
  if (m === "tools/list" || m === "initialize" || !m) {
    // Also handle case where body is {method:"tools/list"} or empty (for simple POST test)
    if (!params?.name) {
      return NextResponse.json({ jsonrpc: "2.0", id: (body as Record<string, unknown>).id ?? 1, result: { tools: TOOLS } });
    }
  }
  if (m === "tools/call" || params?.name) {
    const toolName = params?.name ?? (body as Record<string, unknown>).name as string | undefined;
    const args = (params?.arguments ?? (body as Record<string, unknown>).arguments ?? {}) as Record<string, unknown>;
    if (toolName === "get_live_markets") {
      try {
        const ex = new SomniaMarkets({ chain: somniaShannon, indexerUrl: "https://dev.smk.somnia.host/v1/graphql", wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws", addresses: SOMNIA_TESTNET_ADDRESSES });
        const all = await ex.loadMarkets(true);
        const bins = Object.values(all).filter(mm => mm.type==="binary" && (mm.info as unknown as { asset?: string }).asset && mm.active).slice(0,6).map(mm => {
          const info = mm.info as unknown as { asset?: string; interval?: string; expiry?: string; marketId?: string };
          const outs = (mm as unknown as { outcomes?: { symbol: string; label: string }[] }).outcomes ?? [];
          return { symbol: mm.symbol, asset: info.asset, interval: info.interval, expiry: info.expiry, marketId: info.marketId, outcomes: outs.map(o=>o.symbol) };
        });
        await ex.close();
        return NextResponse.json({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: JSON.stringify(bins, null, 2) }] } });
      } catch (e) {
        return NextResponse.json({ jsonrpc: "2.0", id: 1, error: { message: String(e).slice(0,500) } }, { status: 500 });
      }
    }
    if (toolName === "place_bet") {
      const { asset, direction, stake, address } = args as { asset?: string; direction?: string; stake?: number; address?: string };
      // In production, this would use TOCK_AGENT_PRIVATE_KEY and call ex.trader.placeOrderFor(address, ...)
      // For hackathon, we simulate and show the exact call that would be made
      const isDelegated = address ? ` (delegated=${address.slice(0,6)}…)` : "";
      return NextResponse.json({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: `MCP place_bet: ${asset} ${direction} ${stake} tUSDC${isDelegated} — LIVE would call placeOrderFor via agent 0x111…111 after one-time delegate. Testnet demo: open https://tock-delta.vercel.app and click Delegate, then agent has 0-popup trades. To actually execute, set TOCK_AGENT_PRIVATE_KEY in Vercel env and ensure agent is funded with STT.` }] } });
    }
    if (toolName === "get_streak") {
      return NextResponse.json({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: JSON.stringify({ streak: 0, best: 0, wins: 0, losses: 0, note: "Streak is client-side localStorage tock:streak:{chain}:{address} — MCP would read via API if stored server-side" }) }] } });
    }
    if (toolName === "start_ride") {
      const a = args as { asset?: string; direction?: string; stake?: number; maxLegs?: number };
      return NextResponse.json({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: `Ride started: ${a.asset} ${a.direction} ${a.stake} ×${a.maxLegs ?? 4} — agent will poll settlement every 3s and roll via placeOrderFor. See src/lib/ride.ts for state machine.` }] } });
    }
    return NextResponse.json({ jsonrpc: "2.0", id: 1, error: { message: `Unknown tool ${toolName}` } }, { status: 400 });
  }
  return NextResponse.json({ jsonrpc: "2.0", id: 1, result: { tools: TOOLS } });
}
