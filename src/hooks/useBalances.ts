"use client";

import { useEffect, useState } from "react";
import { erc20Abi, formatUnits } from "viem";
import { addressesForChain } from "@/lib/somnia";
import { COLLATERAL_DECIMALS } from "@/config/markets";

export type Balances = {
  collateral: string;
  native: string;
  decimals: number;
};

type PublicClientLike = {
  readContract: (args: never) => Promise<bigint>;
  getBalance: (args: { address: `0x${string}` }) => Promise<bigint>;
};

/** Polls collateral + native balances for the connected wallet. */
export function useBalances(
  chainId: number,
  address: `0x${string}` | undefined,
  publicClientInput: unknown,
  pollMs = 6000
): Balances | null {
  const [balances, setBalances] = useState<Balances | null>(null);
  const publicClient = publicClientInput as PublicClientLike | undefined | null;

  useEffect(() => {
    if (!address || !publicClient) {
      setBalances(null);
      return;
    }
    let dead = false;
    const fetchBal = async () => {
      try {
        const addrs = addressesForChain(chainId);
        const collateral =
          (addrs as unknown as { collateral?: `0x${string}`; testUsdc?: `0x${string}` }).collateral ??
          (addrs as unknown as { testUsdc?: `0x${string}` }).testUsdc;
        const decimals = COLLATERAL_DECIMALS[chainId] ?? 6;
        let collStr = "—";
        if (collateral) {
          try {
            const raw = (await publicClient.readContract({
              address: collateral,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            } as never)) as bigint;
            collStr = formatUnits(raw, decimals);
          } catch {}
        }
        const nativeRaw = await publicClient.getBalance({ address });
        if (!dead) setBalances({ collateral: collStr, native: formatUnits(nativeRaw, 18), decimals });
      } catch {}
    };
    fetchBal();
    const id = setInterval(fetchBal, pollMs);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [address, publicClient, chainId, pollMs]);

  return balances;
}
