"use client";

export function FaucetPanel({ onFaucet, busy, msg }: { onFaucet: () => void; busy: boolean; msg: string | null }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-3xl border border-gold/25 bg-gradient-to-b from-gold/[0.08] to-transparent p-5">
      <div className="flex items-center justify-between">
        <div className="font-display text-sm font-bold">Testnet faucet</div>
        <span className="rounded-full bg-gold px-2 py-0.5 text-[10px] font-black tracking-wide text-black">10K tUSDC</span>
      </div>
      <p className="text-xs leading-relaxed text-zinc-400">
        Free play money on Shannon. You still need STT for gas — claim that at testnet.somnia.network.
      </p>
      <button
        onClick={onFaucet}
        disabled={busy}
        className="rounded-2xl bg-gold py-3 text-sm font-bold text-black transition hover:bg-amber-300 active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? "Requesting…" : "Get 10,000 tUSDC"}
      </button>
      {msg && <div className="break-words rounded-xl border border-white/10 bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-amber-200">{msg}</div>}
    </div>
  );
}
