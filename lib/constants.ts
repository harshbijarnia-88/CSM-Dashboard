export const CSM_LIST = [
  "Aastha Jindal",
  "Janhvi Gupta",
  "Joe Huisman",
  "Saumitra Shekhar",
] as const;

export const GRR_TARGET = 0.95;
export const NRR_TARGET = 1.1;

/**
 * The column used to attribute a row to a CSM in filters and charts.
 * We use `effective_csm` (derived in fetchReport): the SF `CSM` field when
 * set, falling back to `Opportunity Owner`. This pulls non-CSM-owned deals
 * (Bhargav, Brooks, Mark) into the right CSM cohort when SF has mapped them.
 */
export const CSM_COL = "effective_csm";
export const QUARTER_COL = "Opp_closed_date_quarter";

export const GVIZ_URL =
  "https://docs.google.com/spreadsheets/d/1_mnKGada5DP-0uAWJ_Av9RJH1ed1bseQozYVvDEA72o/gviz/tq?tqx=out:csv&gid=0";

export const QUARTER_COLORS: Record<string, string> = {
  "Q1 CY2025": "#1f77b4",
  "Q2 CY2025": "#56b4e9",
  "Q3 CY2025": "#7b3fbb",
  "Q4 CY2025": "#c094df",
  "Q1 CY2026": "#1f77b4",
  "Q2 CY2026": "#56b4e9",
  "Q3 CY2026": "#7b3fbb",
  "Q4 CY2026": "#c094df",
  "Q1 CY2027": "#1f77b4",
  "Q2 CY2027": "#56b4e9",
  "Q3 CY2027": "#7b3fbb",
  "Q4 CY2027": "#c094df",
};

/** Fiscal years displayed in the quarter filter. Jan–Dec FY assumption. */
export const FY_OPTIONS = [2026, 2027] as const;

export function currentFiscalYear(now: Date = new Date()): number {
  // Jan-Dec FY → current FY = current calendar year.
  return now.getFullYear();
}

export function buildQuarterKey(q: 1 | 2 | 3 | 4, fy: number): string {
  return `Q${q} CY${fy}`;
}

export function fyQuarters(fy: number): string[] {
  return [1, 2, 3, 4].map((n) => buildQuarterKey(n as 1 | 2 | 3 | 4, fy));
}

export const ALL_CSM = "All";
