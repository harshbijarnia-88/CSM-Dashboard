"use client";

import { useMemo, useState } from "react";
import {
  ALL_CSM,
  CSM_COL,
  CSM_LIST,
  QUARTER_COL,
  currentFiscalYear,
  fyQuarters,
} from "@/lib/constants";
import type { Row } from "@/lib/data/types";
import { applyFilters, distinctQuarters } from "@/lib/filters";
import { sum } from "@/lib/metrics";
import { Filters } from "./Filters";
import { Header } from "./Header";
import { NrrGapOpportunities } from "./NrrGapOpportunities";
import { OpportunitiesTable } from "./OpportunitiesTable";
import { SectionA } from "./SectionA";
import { SectionB } from "./SectionB";
import { SectionPostmaster } from "./SectionPostmaster";

export type DashboardProps = {
  rows: Row[];
  fetchedAt: string;
  expansionRows?: Row[];
};

export function Dashboard({ rows, fetchedAt, expansionRows = [] }: DashboardProps) {
  const quarterOptions = useMemo(() => distinctQuarters(rows), [rows]);

  const quarterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const q = String(r[QUARTER_COL] ?? "").trim();
      if (q) counts[q] = (counts[q] || 0) + 1;
    }
    return counts;
  }, [rows]);

  const defaultQuarterSel = useMemo(() => {
    const currentFyQuarters = fyQuarters(currentFiscalYear());
    // Only seed with quarters that actually have data in the sheet.
    const present = currentFyQuarters.filter(
      (q) => (quarterCounts[q] ?? 0) > 0,
    );
    return present.length > 0 ? present : quarterOptions;
  }, [quarterCounts, quarterOptions]);

  const [quarterSel, setQuarterSel] = useState<string[]>(defaultQuarterSel);
  const [csmSel, setCsmSel] = useState<string[]>([ALL_CSM]);

  const { tileRows, chartRows } = useMemo(
    () => applyFilters(rows, quarterSel, csmSel),
    [rows, quarterSel, csmSel],
  );

  // CSM counts respect the quarter selection but ignore the CSM selection so
  // the chip totals don't go to zero when narrowing.
  const { csmCounts, totalOppCount } = useMemo(() => {
    const qFiltered =
      quarterSel.length > 0
        ? rows.filter((r) =>
            quarterSel.includes(String(r[QUARTER_COL] ?? "")),
          )
        : rows;
    const counts: Record<string, number> = {};
    for (const name of CSM_LIST) counts[name] = 0;
    for (const r of qFiltered) {
      const owner = String(r[CSM_COL] ?? "");
      if (counts[owner] !== undefined) counts[owner] += 1;
    }
    return { csmCounts: counts, totalOppCount: qFiltered.length };
  }, [rows, quarterSel]);

  const effectiveQuarters =
    quarterSel.length > 0 ? quarterSel : quarterOptions;

  const totalProjectedNrr = useMemo(
    () => sum(tileRows, "To_include_in_NRR"),
    [tileRows],
  );

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-8 px-6 py-10">
      <SectionPostmaster />
      <div data-section="Header">
        <Header
          fetchedAt={fetchedAt}
          totalProjectedNrr={totalProjectedNrr}
          rowCount={tileRows.length}
        />
      </div>
      <div data-section="Filters">
        <Filters
          quarterCounts={quarterCounts}
          quarterSel={quarterSel}
          onQuarterChange={setQuarterSel}
          csmCounts={csmCounts}
          totalOppCount={totalOppCount}
          csmSel={csmSel}
          onCsmChange={setCsmSel}
        />
      </div>
      <div data-section="Projected & Gaps">
        <SectionA
          tileRows={tileRows}
          chartRows={chartRows}
          selectedQuarters={effectiveQuarters}
          expansionRows={expansionRows}
          quarterSel={quarterSel}
          csmSel={csmSel}
        />
      </div>
      <div data-section="NRR Gap Deals">
        <NrrGapOpportunities rows={tileRows} />
      </div>
      <div data-section="Actuals">
        <SectionB
          tileRows={tileRows}
          chartRows={chartRows}
          selectedQuarters={effectiveQuarters}
        />
      </div>
      <div data-section="Opportunities">
        <OpportunitiesTable rows={tileRows} />
      </div>
    </div>
  );
}
