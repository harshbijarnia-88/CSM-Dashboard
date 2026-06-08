import { ALL_CSM, CSM_COL, CSM_LIST, QUARTER_COL } from "./constants";
import type { Row } from "./data/types";

export type FilteredRows = {
  tileRows: Row[];
  chartRows: Row[];
};

export function applyFilters(
  rows: Row[],
  quarterSel: string[],
  csmSel: string[],
): FilteredRows {
  const qFiltered =
    quarterSel.length > 0
      ? rows.filter((r) => quarterSel.includes(String(r[QUARTER_COL] ?? "")))
      : rows;

  const allCsmActive = csmSel.length === 0 || csmSel.includes(ALL_CSM);

  const tileRows = allCsmActive
    ? qFiltered
    : qFiltered.filter((r) => csmSel.includes(String(r[CSM_COL] ?? "")));

  const csmList = new Set<string>(CSM_LIST as readonly string[]);
  const chartRows = tileRows.filter((r) =>
    csmList.has(String(r[CSM_COL] ?? "")),
  );

  return { tileRows, chartRows };
}

export function distinctQuarters(rows: Row[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const q = String(r[QUARTER_COL] ?? "").trim();
    if (q) set.add(q);
  }
  return Array.from(set).sort();
}
