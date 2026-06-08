#!/usr/bin/env node
// Smoke-test the live data against §11 acceptance numbers using the same
// normalize + metric pipeline as the app.
import Papa from "papaparse";

const GVIZ_URL =
  "https://docs.google.com/spreadsheets/d/1_mnKGada5DP-0uAWJ_Av9RJH1ed1bseQozYVvDEA72o/gviz/tq?tqx=out:csv&gid=0";

const GRR_TARGET = 0.95;
const NRR_TARGET = 1.1;

const RENAME = {
  "Projected NRR (numerator)": "To_include_in_NRR",
  "Projected GRR (numerator)": "To_include_in_GRR_v2",
  ARR_PriorCV_Closed_Renewal_only__c: "ARR_PriorCV_Closed_Renewal_only_c",
  ARR_PriorCV_Expected_Churn__c: "ARR_PriorCV_Expected_Churn_c",
  ARR_PriorCV_High_Risk_Renewal__c: "ARR_PriorCV_High_Risk_Renewal_c",
  ARR_PriorCV_churned__c: "ARR_PriorCV_churned_c",
};

const NUM_COLS = [
  "To_include_in_NRR",
  "To_include_in_GRR_v2",
  "NRR_Base",
  "Base_GRR",
  "NRR_actuals",
  "GRR_actuals",
  "ARR_High_Risk_Renewal",
  "ARR_Expected_Churn",
  "Expansion_contri",
  "ARR_PriorCV_Closed_Renewal_only_c",
  "ARR_PriorCV_Expected_Churn_c",
  "ARR_PriorCV_High_Risk_Renewal_c",
  "ARR_PriorCV_churned_c",
  "Embedded_renewal_uplift_amt",
  "closed_won_ARR",
];

const coerce = (v) => {
  if (v == null) return 0;
  const raw = String(v).trim();
  if (!raw) return 0;
  const isPct = raw.endsWith("%");
  const s = raw.replace(/[$,%\s]/g, "");
  if (!s) return 0;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return isPct ? n / 100 : n;
};

const sum = (rows, col) => rows.reduce((a, r) => a + (Number(r[col]) || 0), 0);
const safeDiv = (a, b) => (b === 0 ? NaN : a / b);

const fmtCurrency = (v) => {
  if (!Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
};
const fmtPct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : "—");

async function main() {
  const res = await fetch(GVIZ_URL);
  if (!res.ok) throw new Error(`fetch failed ${res.status}`);
  const csv = await res.text();
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

  const rows = [];
  for (const raw of parsed.data) {
    const owner = String(raw["Opportunity Owner"] ?? "").trim();
    const dealName = String(raw["Deal Name"] ?? "").trim();
    if (!owner || !dealName) continue;
    const next = {};
    for (const [k, v] of Object.entries(raw)) {
      next[RENAME[k] ?? k] = v;
    }
    for (const c of NUM_COLS) next[c] = coerce(next[c]);
    rows.push(next);
  }

  console.log(`Rows after subtotal drop: ${rows.length}`);

  const pctGrrGap = () => {
    const b = sum(rows, "Base_GRR");
    return safeDiv(GRR_TARGET * b - sum(rows, "To_include_in_GRR_v2"), b);
  };
  const pctNrrGap = () => {
    const b = sum(rows, "Base_GRR");
    return safeDiv(NRR_TARGET * b - sum(rows, "To_include_in_NRR"), b);
  };
  const grrGapD = () =>
    GRR_TARGET * sum(rows, "Base_GRR") - sum(rows, "To_include_in_GRR_v2");
  const nrrGapD = () =>
    NRR_TARGET * sum(rows, "Base_GRR") - sum(rows, "To_include_in_NRR");
  const renewalArrDueYtd = () =>
    sum(rows, "Base_GRR") -
    sum(rows, "ARR_PriorCV_Closed_Renewal_only_c") -
    sum(rows, "ARR_PriorCV_Expected_Churn_c") -
    sum(rows, "ARR_PriorCV_High_Risk_Renewal_c") -
    sum(rows, "ARR_PriorCV_churned_c");

  const results = [
    ["% GRR Gap", fmtPct(pctGrrGap()), "≈ 4.1%"],
    ["% NRR Gap", fmtPct(pctNrrGap()), "≈ 10.5%"],
    ["Target GRR Gap", fmtCurrency(grrGapD()), "≈ $170K"],
    ["NRR Gap", fmtCurrency(nrrGapD()), "≈ $437K"],
    ["FY26 ARR High Risk Renewal", fmtCurrency(sum(rows, "ARR_High_Risk_Renewal")), "≈ $137K"],
    ["FY26 ARR Expected Churn", fmtCurrency(sum(rows, "ARR_Expected_Churn")), "≈ $8K"],
    ["Closed-Won Renewal", fmtCurrency(sum(rows, "closed_won_ARR")), "≈ $2.2M"],
    ["Renewal Remaining", fmtCurrency(renewalArrDueYtd()), "≈ $3.8M"],
  ];

  console.log("");
  console.log("Tile                              Actual          Expected");
  console.log("--------------------------------  --------------  ---------");
  for (const [name, actual, exp] of results) {
    console.log(`${name.padEnd(32)}  ${actual.padEnd(14)}  ${exp}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
