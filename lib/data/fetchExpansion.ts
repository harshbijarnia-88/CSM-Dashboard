import Papa from "papaparse";
import type { Row } from "./types";

const EXPANSION_GVIZ_URL =
  "https://docs.google.com/spreadsheets/d/15y3PTmmERgHz9beHYzaUtWwDIMJ_RLlgfWrItvzwAoI/gviz/tq?tqx=out:csv&gid=0";

export type FetchExpansionResult = {
  rows: Row[];
  fetchedAt: string;
};

function coerceNumeric(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const raw = String(v).trim();
  if (!raw) return 0;
  const isPct = raw.endsWith("%");
  const s = raw.replace(/[$,%\s]/g, "");
  if (!s) return 0;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return isPct ? n / 100 : n;
}

const NUMERIC_COLS = ["Amount", "Projected NRR (numerator)", "Prior Contract Value"];

export async function fetchExpansion(): Promise<FetchExpansionResult> {
  const res = await fetch(EXPANSION_GVIZ_URL, { next: { revalidate: 600 } });
  if (!res.ok) {
    throw new Error(`Expansion gviz fetch failed: ${res.status} ${res.statusText}`);
  }
  const csv = await res.text();
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const rows: Row[] = [];
  for (const raw of parsed.data) {
    const owner = String(raw["Opportunity Owner"] ?? "").trim();
    const dealName = String(raw["Deal Name"] ?? "").trim();
    if (!owner || !dealName) continue;

    const next: Row = {};
    for (const [k, v] of Object.entries(raw)) {
      next[k] = v == null ? null : String(v);
    }
    for (const col of NUMERIC_COLS) {
      next[col] = coerceNumeric(next[col]);
    }
    // Expansion sheet has no separate CSM column; effective_csm = Opp Owner.
    next["effective_csm"] = owner;
    rows.push(next);
  }

  return { rows, fetchedAt: new Date().toISOString() };
}

/**
 * Map an SF Stage value to a Forecast Category bucket — mirrors the SF
 * dashboard's "Expansion Opps 2026 - Q1-Q4" donut grouping.
 */
export type ForecastCategory = "Pipeline" | "Commit" | "Closed" | "Best Case" | "Omitted";

export function forecastCategory(stage: string): ForecastCategory {
  const s = (stage ?? "").toLowerCase();
  if (s.includes("closed")) return "Closed";
  if (s.includes("contracting") || s.includes("negotiat") || s.includes("commit"))
    return "Commit";
  if (s.includes("best case") || s.includes("most likely")) return "Best Case";
  if (s.includes("omitted")) return "Omitted";
  return "Pipeline";
}
