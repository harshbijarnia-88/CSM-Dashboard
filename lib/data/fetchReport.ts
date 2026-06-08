import Papa from "papaparse";
import { GVIZ_URL } from "../constants";
import { RAW_NUMERIC_COLS, RENAME_MAP, type Row } from "./types";

export type FetchReportResult = {
  rows: Row[];
  fetchedAt: string;
};

function coerceNumeric(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const raw = String(v).trim();
  if (!raw) return 0;
  // Salesforce sometimes formats currency fields as percent strings
  // (e.g. "1080000.00%" for $10,800). Detect trailing % and divide by 100.
  const isPct = raw.endsWith("%");
  const s = raw.replace(/[$,%\s]/g, "");
  if (!s) return 0;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return isPct ? n / 100 : n;
}

function normalize(rawRows: Record<string, unknown>[]): Row[] {
  const out: Row[] = [];
  for (const raw of rawRows) {
    const owner = String(raw["Opportunity Owner"] ?? "").trim();
    const dealName = String(raw["Deal Name"] ?? "").trim();
    // SF subtotal rows have empty identifiers and pre-aggregated numerics that double-count.
    if (!owner || !dealName) continue;

    const next: Row = {};
    for (const [k, v] of Object.entries(raw)) {
      const canonical = RENAME_MAP[k] ?? k;
      next[canonical] = v == null ? null : String(v);
    }
    for (const col of RAW_NUMERIC_COLS) {
      next[col] = coerceNumeric(next[col]);
    }

    // Per-type attribution:
    //   • Renewals  → Opportunity Owner (the CSM owns the renewal opp directly).
    //   • Expansion → `CSM owner` column (the AE owns the opp, the CSM is the
    //                  relationship — read it from the dedicated column).
    // Empty fallbacks land in "Unattributed" so they don't bleed into the chart.
    const type = String(raw["Type"] ?? "").trim();
    const csmOwner = String(raw["CSM owner"] ?? "").trim();
    let effective: string;
    let attribution: "opp-owner" | "csm-owner" | "unattributed";
    if (type === "Renewals") {
      effective = owner || "Unattributed";
      attribution = owner ? "opp-owner" : "unattributed";
    } else {
      effective = csmOwner || "Unattributed";
      attribution = csmOwner ? "csm-owner" : "unattributed";
    }
    next["effective_csm"] = effective;
    next["_csm_attribution"] = attribution;
    out.push(next);
  }
  return out;
}

export async function fetchReport(): Promise<FetchReportResult> {
  const res = await fetch(GVIZ_URL, { next: { revalidate: 600 } });
  if (!res.ok) {
    throw new Error(`gviz fetch failed: ${res.status} ${res.statusText}`);
  }
  const csv = await res.text();
  const parsed = Papa.parse<Record<string, unknown>>(csv, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (parsed.errors.length > 0) {
    console.warn("[fetchReport] PapaParse warnings:", parsed.errors.slice(0, 3));
  }
  const rows = normalize(parsed.data);
  return { rows, fetchedAt: new Date().toISOString() };
}
