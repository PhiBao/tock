import { SOMNIA_MAINNET_ADDRESSES, SOMNIA_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { somniaMainnet, somniaShannon } from "./chains";

export const INDEXER_URL = {
  5031: "https://prd.smk.somnia.host/v1/graphql",
  50312: "https://dev.smk.somnia.host/v1/graphql",
} as const;

export const WS_RPC_URL = {
  5031: "wss://api.infra.mainnet.somnia.network/ws",
  50312: "wss://api.infra.testnet.somnia.network/ws",
} as const;

export const ADDRESSES = {
  5031: SOMNIA_MAINNET_ADDRESSES,
  50312: SOMNIA_TESTNET_ADDRESSES,
} as const;

// Keep venue filtering optional — if venueId unknown, show all.
// When we discover a live market we read its venueId from the row.
export const DEFAULT_CHAIN = somniaShannon; // default to testnet for safe demo
export const CHAINS = { 5031: somniaMainnet, 50312: somniaShannon } as const;

export const COLLATERAL_DECIMALS: Record<number, number> = {
  5031: 18,
  50312: 6,
};

export const COLLATERAL_SYMBOL: Record<number, string> = {
  5031: "USDso",
  50312: "tUSDC",
};

// Oracle explorer deep-link for settlement audit
export const oracleExplorerUrl = (questionId: string) =>
  `https://prd.oracle.somnia.host/questions/${questionId}?view=graph`;
