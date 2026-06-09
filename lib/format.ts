export function fmtCurrency(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

/** Full-precision currency with thousands separators — used as a hover
 * tooltip on the abbreviated tile values so users can see the exact $. */
export function fmtCurrencyFull(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;
}

export function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}
