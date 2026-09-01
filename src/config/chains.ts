import { defineChain } from "viem";

export const somniaMainnet = defineChain({
  id: 5031,
  name: "Somnia",
  nativeCurrency: { name: "Somnia", symbol: "SOMI", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://api.infra.mainnet.somnia.network"],
      webSocket: ["wss://api.infra.mainnet.somnia.network/ws"],
    },
  },
  blockExplorers: {
    default: { name: "Somnia Explorer", url: "https://explorer.somnia.network" },
  },
  contracts: {
    multicall3: { address: "0x5e44F178E8cF9B2F5409B6f18ce936aB817C5a11", blockCreated: 38516341 },
  },
});

export const somniaShannon = defineChain({
  id: 50312,
  name: "Somnia Shannon",
  nativeCurrency: { name: "STT", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://api.infra.testnet.somnia.network", "https://dream-rpc.somnia.network"],
      webSocket: ["wss://api.infra.testnet.somnia.network/ws", "wss://dream-rpc.somnia.network/ws"],
    },
  },
  blockExplorers: {
    default: { name: "Shannon Explorer", url: "https://shannon-explorer.somnia.network" },
  },
  contracts: {
    multicall3: { address: "0x841b8199E6d3Db3C6f264f6C2bd8848b3cA64223", blockCreated: 71314235 },
  },
  testnet: true,
});

export const supportedChains = [somniaMainnet, somniaShannon] as const;
export type SupportedChainId = (typeof supportedChains)[number]["id"];

export const CHAIN_BY_ID: Record<number, typeof somniaMainnet | typeof somniaShannon> = {
  5031: somniaMainnet,
  50312: somniaShannon,
};
