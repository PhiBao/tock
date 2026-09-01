"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected, coinbaseWallet } from "wagmi/connectors";
import { somniaMainnet, somniaShannon } from "@/config/chains";
import { useState } from "react";

const wagmiConfig = createConfig({
  chains: [somniaMainnet, somniaShannon],
  transports: {
    [somniaMainnet.id]: http("https://api.infra.mainnet.somnia.network"),
    [somniaShannon.id]: http("https://api.infra.testnet.somnia.network"),
  },
  connectors: [injected(), coinbaseWallet({ appName: "Tock" })],
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
