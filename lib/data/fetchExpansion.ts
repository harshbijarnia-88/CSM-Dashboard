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
export type ForecastCategory =
  | "Pipeline"
  | "Most Likely"
  | "Commit"
  | "Closed Won"
  | "Closed Lost"
  | "Omitted";

export function forecastCategory(stage: string): ForecastCategory {
  const s = (stage ?? "").toLowerCase();
  // Stage-only fallback used when the SF Forecast Category column is empty.
  // Order matters: "closed won" is checked before the broader "closed" /
  // "dead" fallbacks so a Closed Won stage doesn't get caught by the lost
  // branch first.
  if (s.includes("closed won")) return "Closed Won";
  if (s.includes("closed") || s.includes("dead") || s.includes("churn"))
    return "Closed Lost";
  if (s.includes("contracting") || s.includes("negotiat") || s.includes("commit"))
    return "Commit";
  if (s.includes("most likely") || s.includes("best case")) return "Most Likely";
  if (s.includes("omitted")) return "Omitted";
  return "Pipeline";
}

/**
 * Authoritative forecast-category resolver — reads SF's "Forecast Category"
 * column when present, then splits SF's `Closed` bucket into Closed Won vs
 * Closed Lost using Stage. Falls back to the stage-based heuristic when the
 * SF column is empty.
 */
export function forecastCategoryFromRow(r: Row): ForecastCategory {
  const sfCat = String(r["Forecast Category"] ?? "").trim();
  const stage = String(r["Stage"] ?? "");
  const stageLower = stage.toLowerCase();
  if (sfCat) {
    // SF's "Closed" forecast bucket spans both won and lost — split by stage
    // so the donut surfaces them as separate slices.
    if (sfCat.toLowerCase() === "closed") {
      return stageLower.includes("closed won") ? "Closed Won" : "Closed Lost";
    }
    if (sfCat === "Commit") return "Commit";
    if (sfCat === "Pipeline") return "Pipeline";
    if (sfCat === "Omitted") return "Omitted";
    if (sfCat === "Most Likely" || sfCat === "Best Case") return "Most Likely";
  }
  return forecastCategory(stage);
}
