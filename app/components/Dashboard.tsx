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

  // Renewal-status filter shared between the NRR Gap drilldown (in
  // SectionA Pod 1) and the Renewal Opportunities table. When the user
  // clicks the NRR Gap tile we set this to the three risk statuses + jump
  // the page to where the table starts.
  const [renewalStatusFilter, setRenewalStatusFilter] = useState<Set<string>>(
    () => new Set(),
  );
  // Stage filter on the Renewal Opportunities table — drilldowns set
  // this alongside the status filter so the table only surfaces
  // actionable rows. Empty = no stage filter applied.
  const [renewalStageFilter, setRenewalStageFilter] = useState<Set<string>>(
    () => new Set(),
  );
  // Generic helper — sets a renewal-status filter (and optionally a
  // stage filter) and jumps to the Renewal Opportunities section. Used
  // by GRR Gap (at-risk drilldown), Renewal % Upgrade (upgrade
  // drilldown), and Book in Risk.
  const jumpToRenewalsWithStatuses = (
    statuses: string[],
    stages: string[] = [],
  ) => {
    setRenewalStatusFilter(new Set(statuses));
    setRenewalStageFilter(new Set(stages));
    requestAnimationFrame(() => {
      scrollToSection("Renewal Opportunities");
    });
  };

  const applyGrrGapFilters = () => {
    jumpToRenewalsWithStatuses([
      "High Risk Renewal",
      "Expected Churn",
      "Likely to Downgrade",
    ]);
  };

  // % Book in Risk drilldown: high-risk + expected churn, narrowed
  // further to the OPEN renewal stages so the table excludes Closed
  // Won / Closed Lost — only actionable at-risk renewals show.
  const applyBookInRiskFilter = () =>
    jumpToRenewalsWithStatuses(
      ["High Risk Renewal", "Expected Churn"],
      ["Renewal Anticipation", "Proposal Discussion", "Renewal Confirmation"],
    );

  const applyRenewalUpgradeFilter = () =>
    jumpToRenewalsWithStatuses(["Likely to Upgrade"]);

  const applyExpansionCommitClosedFilter = () => {
    setExpansionCategoryFilter(new Set(["Commit", "Closed Won"]));
    requestAnimationFrame(() => {
      scrollToSection("Expansion Opps");
    });
  };

  // Shared scroll-to-section primitive. When embedded as an iframe inside
  // the revenue-os shell, the iframe auto-resizes to content height and
  // has no internal scroll — the parent page is what actually scrolls.
  // Tell the parent which section to jump to via postMessage; if
  // standalone (top-level), scroll locally.
  function scrollToSection(sectionId: string) {
    if (typeof window === "undefined") return;
    if (window.self !== window.top) {
      try {
        window.parent.postMessage(
          { type: "csm-bob:scroll-to", sectionId },
          "*",
        );
        return;
      } catch {
        // Cross-origin block — fall through to in-document scroll.
      }
    }
    const target = document.querySelector(`[data-section="${sectionId}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
    <div className="mx-auto flex max-w-[1500px] flex-col gap-10 px-6 pt-10 pb-0 [&>[data-section]]:scroll-mt-32">
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
          onApplyGrrGapFilters={applyGrrGapFilters}
          onApplyRenewalUpgradeFilter={applyRenewalUpgradeFilter}
          onApplyExpansionCommitClosedFilter={applyExpansionCommitClosedFilter}
          onApplyBookInRiskFilter={applyBookInRiskFilter}
          middleSlot={
            <div data-section="Expansion Opps">
              <ExpansionOpportunitiesTable
                rows={tileRows}
                selectedCategories={expansionCategoryFilter}
                onClearCategories={clearExpansionCategories}
                onToggleCategory={toggleExpansionCategory}
              />
            </div>
          }
        />
      </div>
      <div
        data-section="Renewal Opportunities"
        className="rounded-2xl bg-white/40 p-5 ring-1 ring-line/60 backdrop-blur-sm"
      >
        <OpportunitiesTable
          rows={tileRows}
          statusFilter={renewalStatusFilter}
          onStatusFilterChange={setRenewalStatusFilter}
          stageFilter={renewalStageFilter}
          onStageFilterChange={setRenewalStageFilter}
        />
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
