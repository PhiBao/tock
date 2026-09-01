"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";

export function WalletConnect() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-xs font-mono bg-white/10 px-2 py-1 rounded-full">
          {address.slice(0, 6)}…{address.slice(-4)} {chainId ? `· ${chainId}` : ""}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs px-3 py-1.5 rounded-full bg-white text-black font-medium hover:bg-zinc-200 transition"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => connect({ connector: injected() })}
        disabled={isPending}
        className="text-sm px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-zinc-100 disabled:opacity-60 transition"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      <button
        onClick={() => switchChain({ chainId: 50312 })}
        className="hidden sm:inline text-xs px-3 py-1.5 rounded-full border border-white/20 text-white/80 hover:bg-white/10"
      >
        Shannon
      </button>
      <button
        onClick={() => switchChain({ chainId: 5031 })}
        className="hidden sm:inline text-xs px-3 py-1.5 rounded-full border border-white/20 text-white/80 hover:bg-white/10"
      >
        Somnia
      </button>
    </div>
  );
}
