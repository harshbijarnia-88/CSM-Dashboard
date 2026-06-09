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
import type { ForecastCategory } from "@/lib/data/fetchExpansion";
import { applyFilters, distinctQuarters } from "@/lib/filters";
import { sum } from "@/lib/metrics";
import { ExpansionOpportunitiesTable } from "./ExpansionOpportunitiesTable";
import { Filters } from "./Filters";
import { OpportunitiesTable } from "./OpportunitiesTable";
import { StandaloneTopBar } from "./StandaloneTopBar";
import { SectionA } from "./SectionA";
import { SectionB } from "./SectionB";
import { SectionPostmaster } from "./SectionPostmaster";
import { SummaryPostmaster } from "./SummaryPostmaster";

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
  // Donut → table linkage: clicking a slice on the Expansion donut toggles
  // membership in this set, which the table picks up and filters by.
  const [expansionCategoryFilter, setExpansionCategoryFilter] = useState<
    Set<ForecastCategory>
  >(() => new Set());
  const toggleExpansionCategory = (cat: ForecastCategory) => {
    setExpansionCategoryFilter((curr) => {
      const next = new Set(curr);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };
  const clearExpansionCategories = () =>
    setExpansionCategoryFilter(new Set());

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
  const renewalBase = useMemo(
    () => sum(tileRows, "NRR_Base"),
    [tileRows],
  );

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col gap-8 px-6 pt-10 pb-0">
      <SectionPostmaster />
      <SummaryPostmaster
        projectedArr={totalProjectedNrr}
        renewalBase={renewalBase}
        rowCount={tileRows.length}
        fetchedAt={fetchedAt}
      />
      {/* Standalone-only top bar — mirrors the StickyTopBar that the
          revenue-os shell injects above the iframe. Renders nothing when
          embedded, so the parent shell doesn't double-render. */}
      <StandaloneTopBar
        projectedArr={totalProjectedNrr}
        renewalBase={renewalBase}
        rowCount={tileRows.length}
        fetchedAt={fetchedAt}
      />
      {/* The original in-iframe Header is gone — the revenue-os shell now
          owns the combined sticky navigation + summary bar (its values stream
          in over postMessage). Keeping a zero-height anchor so existing
          deep-links to the top still resolve. */}
      <div data-section="Header" className="sr-only" />
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
          expansionCategoryFilter={expansionCategoryFilter}
          onToggleExpansionCategory={toggleExpansionCategory}
          middleSlot={
            <div data-section="Expansion Opps">
              <ExpansionOpportunitiesTable
                rows={tileRows}
                selectedCategories={expansionCategoryFilter}
                onClearCategories={clearExpansionCategories}
              />
            </div>
          }
        />
      </div>
      <div data-section="Renewal Opportunities">
        <OpportunitiesTable rows={tileRows} />
      </div>
      <div data-section="Actuals">
        <SectionB
          tileRows={tileRows}
          chartRows={chartRows}
          selectedQuarters={effectiveQuarters}
        />
      </div>
    </div>
  );
}
