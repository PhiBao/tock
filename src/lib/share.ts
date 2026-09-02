/* Canvas share card — the organic-distribution primitive.
   Renders the streak + current window into a 1080×600 PNG and either
   downloads it or hands it to the native share sheet on mobile. */

import { intervalLabel, fmtProb } from "@/lib/format";

export type ShareCardInput = {
  streakKey: string;
  asset?: string;
  intervalSec?: number;
  mid?: number;
  siteUrl?: string;
};

function readStreakText(key: string): string {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const s = JSON.parse(raw) as { current?: number; best?: number; wins?: number; losses?: number };
      return `Streak ${s.current ?? 0}  ·  Best ${s.best ?? 0}  ·  ${s.wins ?? 0}W-${s.losses ?? 0}L`;
    }
  } catch {}
  return "Streak 0 — start your run";
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderShareCard(input: ShareCardInput): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 600;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(0, 0, c.width, 8);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 72px system-ui, sans-serif";
  ctx.fillText("Tock", 48, 100);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillText("CALL THE NEXT 15 MINUTES  ·  DreamDEX on Somnia", 48, 135);

  const streakText = readStreakText(input.streakKey);
  ctx.fillStyle = "#141417";
  ctx.strokeStyle = "#27272a";
  ctx.lineWidth = 2;
  const boxY = 180;
  rr(ctx, 48, boxY, 984, 140, 24);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 36px system-ui, sans-serif";
  ctx.fillText(streakText, 80, boxY + 60);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "400 22px system-ui, sans-serif";
  const marketLine = input.asset
    ? `${input.asset} · ${intervalLabel(input.intervalSec ?? 900)}  ·  Up ${fmtProb(input.mid)}`
    : "No market selected";
  ctx.fillText(marketLine, 80, boxY + 95);

  ctx.fillStyle = "#52525b";
  ctx.font = "500 20px system-ui, sans-serif";
  ctx.fillText(`Zero fees  ·  Self-custody  ·  Auditable oracle  ·  ${input.siteUrl ?? "tock"}` , 48, 560);

  return c;
}

/** Render + immediately download (no preview). Kept for programmatic use. */
export function downloadShareCard(input: ShareCardInput) {
  const c = renderShareCard(input);
  if (!c) return;
  downloadCanvas(c, `tock-streak-${Date.now()}.png`);
}

/** Save an already-rendered share card as a PNG file. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}
