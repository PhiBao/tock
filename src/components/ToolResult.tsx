"use client";

import { useState } from "react";

type ContentBlock = { type?: string; text?: string };

type Envelope = {
  result?: { content?: ContentBlock[] };
  error?: { message?: string };
};

function tryJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function mmss(expirySec: number): string {
  const s = Math.max(0, Math.floor(expirySec - Date.now() / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function MarketTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-left font-mono text-[11px]">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-zinc-500">
            <th className="px-3 py-2 font-semibold">Market</th>
            <th className="px-3 py-2 font-semibold">Closes in</th>
            <th className="px-3 py-2 font-semibold">Outcomes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const outs = Array.isArray(r["outcomes"]) ? (r["outcomes"] as string[]) : [];
            return (
              <tr key={i} className="border-b border-white/5 last:border-0">
                <td className="px-3 py-2 font-bold text-white">
                  {String(r["asset"] ?? "?")}{" "}
                  <span className="font-medium text-zinc-500">{String(r["interval"] ?? "")}</span>
                  <div className="font-medium text-zinc-600">#{String(r["marketId"] ?? "").slice(-6)}</div>
                </td>
                <td className="px-3 py-2 tabular-nums text-gold">
                  {r["expiry"] !== undefined ? mmss(Number(r["expiry"])) : "—"}
                </td>
                <td className="max-w-[220px] truncate px-3 py-2 text-zinc-400" title={outs.join("\n")}>
                  {outs.length ? `${outs.length} sides` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ObjectGrid({ obj }: { obj: Record<string, unknown> }) {
  return (
    <dl className="grid grid-cols-2 gap-1.5">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="rounded-lg border border-white/[0.07] bg-black/30 px-2.5 py-1.5">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{k}</dt>
          <dd className="truncate font-mono text-xs text-zinc-100" title={String(v)}>
            {typeof v === "object" ? JSON.stringify(v) : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Structured renderer for MCP tool responses. The envelope's text blocks
 *  become prose, market arrays become tables, and raw JSON stays one click
 *  away in a collapsible — long dumps can no longer break the layout. */
export function ToolResult({ tool, data }: { tool: string; data: unknown }) {
  const [showRaw, setShowRaw] = useState(false);
  const env = (data ?? {}) as Envelope;

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-zinc-500">
          <span className="font-bold text-gold">{tool}</span> →{" "}
          {env.error ? <span className="font-bold text-red-400">error</span> : <span className="font-bold text-emerald-400">ok</span>}
        </span>
        <button
          onClick={() => setShowRaw((s) => !s)}
          className="rounded-lg border border-white/10 px-2 py-1 font-mono text-[10px] text-zinc-400 transition hover:bg-white/5 hover:text-white"
        >
          {showRaw ? "Hide raw" : "Raw JSON"}
        </button>
      </div>

      {env.error ? (
        <p className="break-words rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs leading-relaxed text-red-200">
          {env.error.message ?? "Unknown error"}
        </p>
      ) : (env.result?.content ?? []).length === 0 ? (
        <p className="text-xs text-zinc-500">Empty result.</p>
      ) : (
        (env.result?.content ?? []).map((b, i) => {
          const text = b?.text ?? "";
          const inner = tryJson(text);
          if (Array.isArray(inner)) {
            const looksLikeMarkets = inner.length > 0 && typeof inner[0] === "object" && inner[0] !== null && "asset" in (inner[0] as object);
            return looksLikeMarkets ? (
              <MarketTable key={i} rows={inner as Array<Record<string, unknown>>} />
            ) : (
              <pre key={i} className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-zinc-300">
                {JSON.stringify(inner, null, 1)}
              </pre>
            );
          }
          if (inner && typeof inner === "object") {
            return <ObjectGrid key={i} obj={inner as Record<string, unknown>} />;
          }
          return (
            <p key={i} className="break-words text-xs leading-relaxed text-zinc-200">
              {text}
            </p>
          );
        })
      )}

      {showRaw && (
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/[0.07] bg-black/60 p-2.5 font-mono text-[10px] leading-relaxed text-zinc-500">
          {JSON.stringify(data, null, 1)}
        </pre>
      )}
    </div>
  );
}
