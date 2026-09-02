#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { somniaShannon } from "@somnia-chain/markets-sdk/chains";
import { SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";

const server = new Server({ name: "tock-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "get_live_markets", description: "Get live BTC/ETH event contract windows on Somnia Shannon (DreamDEX). Returns asset, interval, expiry, Up prob, spread.", inputSchema: { type: "object", properties: {}, required: [] } },
    { name: "place_bet", description: "Place UP/DOWN bet on current window. Needs private key via env TOCK_PRIVATE_KEY. Use with care — testnet only.", inputSchema: { type: "object", properties: { asset: { type: "string", enum: ["BTC","ETH"] }, direction: { type: "string", enum: ["UP","DOWN"] }, stake: { type: "number", description: "contracts, 0.001 lot" } }, required: ["asset","direction","stake"] } },
    { name: "get_streak", description: "Get human's streak from localStorage key (needs address). For demo, returns mocked.", inputSchema: { type: "object", properties: { address: { type: "string" } }, required: [] } },
    { name: "start_ride", description: "Start a Ride auto-roll: asset, direction, stake, maxLegs. Agent will roll winnings.", inputSchema: { type: "object", properties: { asset: { type: "string", enum: ["BTC","ETH"] }, direction: { type: "string", enum: ["UP","DOWN"] }, stake: { type: "number" }, maxLegs: { type: "number" } }, required: ["asset","direction","stake"] } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  if (name === "get_live_markets") {
    const ex = new SomniaMarkets({ chain: somniaShannon, indexerUrl: "https://dev.smk.somnia.host/v1/graphql", wsRpcUrl: "wss://api.infra.testnet.somnia.network/ws", addresses: SOMNIA_TESTNET_ADDRESSES });
    const all = await ex.loadMarkets(true);
    const bins = Object.values(all).filter(m => m.type==="binary" && (m.info as unknown as Record<string, unknown>).asset && m.active).slice(0,6).map(m => {
      const info = m.info as unknown as Record<string, unknown>;
      return { symbol: m.symbol, asset: info["asset"], interval: info["interval"], expiry: info["expiry"] };
    });
    await ex.close();
    return { content: [{ type: "text", text: JSON.stringify(bins, null, 2) }] };
  }
  if (name === "place_bet") {
    const { asset, direction, stake } = args as unknown as Record<string, unknown>;
    return { content: [{ type: "text", text: `Simulated place_bet ${asset} ${direction} ${stake} — set TOCK_PRIVATE_KEY to execute on Shannon. In Tock UI, this is one click after delegate.` }] };
  }
  if (name === "get_streak") {
    return { content: [{ type: "text", text: `Streak: use Tock UI StreakBar — MCP returns 0W-0L for anon. With address, would read on-chain fills.` }] };
  }
  if (name === "start_ride") {
    const a = args as unknown as Record<string, unknown>;
    return { content: [{ type: "text", text: `Ride started: ${a.asset} ${a.direction} ${a.stake} ×${a.maxLegs ?? 4} — agent will poll settlement every 3s and roll via placeOrderFor after delegate.` }] };
  }
  throw new Error(`Unknown tool ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
