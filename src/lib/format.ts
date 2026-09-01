export function fmtProb(p: number | undefined): string {
  if (p === undefined || Number.isNaN(p)) return "—";
  return `${Math.round(p * 100)}%`;
}

export function fmtPrice(p: number | undefined, decimals = 2): string {
  if (p === undefined || Number.isNaN(p)) return "—";
  return p.toFixed(decimals);
}

export function fmtUSD(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(decimals)}`;
}

export function fmtCountdown(expirySec: number, nowSec: number): string {
  const s = Math.max(0, Math.floor(expirySec - nowSec));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function intervalLabel(sec: number): string {
  if (sec === 900) return "15m";
  if (sec === 3600) return "1h";
  if (sec === 300) return "5m";
  return `${Math.round(sec / 60)}m`;
}

export function assetEmoji(asset: string): string {
  if (asset === "BTC") return "₿";
  if (asset === "ETH") return "Ξ";
  return asset.slice(0, 3);
}
