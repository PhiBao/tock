import { SomniaMarkets } from "@somnia-chain/markets-sdk";
import { ADDRESSES, INDEXER_URL, WS_RPC_URL } from "@/config/markets";
import { somniaMainnet, somniaShannon } from "@/config/chains";
import type { Chain } from "viem";

// Lightweight factory for client-side use.
// For reads (no signer) we omit privateKey/walletClient.
// For writes we pass walletClient from wagmi.

export function chainForId(id: number): Chain {
  if (id === 50312) return somniaShannon;
  return somniaMainnet;
}

export function indexerForChain(id: number): string {
  return INDEXER_URL[id as keyof typeof INDEXER_URL] ?? INDEXER_URL[50312];
}
export function wsForChain(id: number): string {
  return WS_RPC_URL[id as keyof typeof WS_RPC_URL] ?? WS_RPC_URL[50312];
}
export function addressesForChain(id: number) {
  return ADDRESSES[id as keyof typeof ADDRESSES] ?? ADDRESSES[50312];
}

type CreateOpts = {
  chainId: number;
  walletClient?: unknown; // viem WalletClient, passed through to SDK
  privateKey?: `0x${string}`;
};

// Create an exchange. Caller is responsible for calling .close() when done
// (but for a singleton SPA we keep one instance per chain).
export function createExchange(opts: CreateOpts) {
  const chain = chainForId(opts.chainId);
  const indexerUrl = indexerForChain(opts.chainId);
  const wsRpcUrl = wsForChain(opts.chainId);
  const addresses = addressesForChain(opts.chainId);

  const base = {
    chain,
    indexerUrl,
    wsRpcUrl,
    addresses,
  } as const;

  if (opts.walletClient) {
    return new SomniaMarkets({
      ...base,
      // SDK accepts walletClient via TraderConfig
      walletClient: opts.walletClient as never,
    });
  }
  if (opts.privateKey) {
    return new SomniaMarkets({
      ...base,
      privateKey: opts.privateKey,
    });
  }
  return new SomniaMarkets(base);
}
