"use client";

import { type ReactNode, useState } from "react";
import type { Row } from "@/lib/data/types";
import {
  arrExpectedChurn,
  arrHighRiskRenewal,
  embeddedRenewalUpliftPct,
  expansionPctRenewalBase,
  grrGapDollars,
  grrPct,
  nrrGapDollars,
  nrrPct,
  pctBookInRisk,
  pctGrrGap,
  pctNrrGap,
  sum,
} from "@/lib/metrics";
import { fmtCurrency } from "@/lib/format";
import { ChartCollapseToggle } from "./ChartCollapseToggle";
import { CsmQuarterChart } from "./CsmQuarterChart";
import { ExpansionDonut } from "./ExpansionDonut";
import type { ForecastCategory } from "@/lib/data/fetchExpansion";
import { SectionHeader } from "./SectionHeader";
import { StatCard } from "./StatCard";

export type SectionAProps = {
  tileRows: Row[];
  chartRows: Row[];
  selectedQuarters: string[];
  expansionRows: Row[];
  quarterSel: string[];
  csmSel: string[];
  expansionCategoryFilter: Set<ForecastCategory>;
  onToggleExpansionCategory: (cat: ForecastCategory) => void;
  /** Optional content wedged between the top pod row (NRR + Expansion) and
   * the bottom pod row (GRR + Risk). Used to dock the Expansion
   * Opportunities table directly under the expansion donut. */
  middleSlot?: ReactNode;
};

export function SectionA({
  tileRows,
  chartRows,
  selectedQuarters,
  expansionRows,
  quarterSel,
  csmSel,
  expansionCategoryFilter,
  onToggleExpansionCategory,
  middleSlot,
}: SectionAProps) {
  const [chartsCollapsed, setChartsCollapsed] = useState(true);
  return (
    <section className="rounded-2xl bg-white/40 p-5 ring-1 ring-line/60 backdrop-blur-sm">
      <SectionHeader
        subtitle="Forward-looking renewal pipeline and exposure"
        action={
          <ChartCollapseToggle
            collapsed={chartsCollapsed}
            onToggle={() => setChartsCollapsed((c) => !c)}
          />
        }
      >
        Projected & Gaps
      </SectionHeader>

      {/* Two stacked pod rows with an optional slot wedged between them so
          the Expansion Opportunities table can dock directly under the
          expansion donut. Order:
            Row A: Projected NRR%   |  Expansion Opps   (charts)
            Slot:  Expansion Opportunities table
            Row B: Projected GRR%   |  % Book in Risk   (charts)
          Each pod = supporting tiles in a row on top, chart filling below. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Pod 1 — NRR */}
        <div className="flex flex-col gap-3">
          <div className="grid min-h-[140px] grid-cols-2 gap-3 [&>*]:h-full">
            <StatCard
              label="% NRR Gap"
              value={pctNrrGap(tileRows)}
              kind="percent"
              tone="red-when-positive"
              progress={{
                achieved: nrrPct(tileRows),
                target: 1.1,
              }}
            />
            <StatCard
              label="NRR Gap"
              value={nrrGapDollars(tileRows)}
              kind="currency"
              tone="red-when-positive"
              subtitle="110% × Base GRR − Projected NRR · $ needed to hit 110% NRR"
            />
          </div>
          {chartsCollapsed ? null : (
            <CsmQuarterChart
              title="Projected NRR%"
              metric={nrrPct}
              chartRows={chartRows}
              formulaRows={tileRows}
              selectedQuarters={selectedQuarters}
              kind="percent"
              target={1.1}
              targetLabel="110% target"
              formula={{
                numerator: { label: "Projected NRR", field: "To_include_in_NRR" },
                denominator: { label: "NRR Base", field: "NRR_Base" },
              }}
            />
          )}
        </div>

        {/* Pod 2 — Expansion */}
        <div className="flex flex-col gap-3">
          <div className="grid min-h-[140px] grid-cols-2 gap-3 [&>*]:h-full">
            <StatCard
              label="Renewal % Upgrade"
              value={embeddedRenewalUpliftPct(tileRows)}
              kind="percent"
              tone="green"
              secondary={fmtCurrency(sum(tileRows, "Embedded_renewal_uplift_amt"))}
              secondaryRaw={sum(tileRows, "Embedded_renewal_uplift_amt")}
              subtitle="Embedded Renewal % Uplift"
            />
            <StatCard
              label="Standalone Expansion %"
              value={expansionPctRenewalBase(tileRows)}
              kind="percent"
              tone="green"
              secondary={fmtCurrency(sum(tileRows, "Expansion_contri"))}
              secondaryRaw={sum(tileRows, "Expansion_contri")}
              subtitle="Expansion as % of Renewal Base · Commit + Closed-Won only"
            />
          </div>
          {chartsCollapsed ? null : (
            <ExpansionDonut
              rows={expansionRows}
              quarterSel={quarterSel}
              csmSel={csmSel}
              selectedCategories={expansionCategoryFilter}
              onCategoryClick={onToggleExpansionCategory}
            />
          )}
        </div>
      </div>

      {middleSlot ? <div className="mt-5">{middleSlot}</div> : null}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Pod 3 — GRR */}
        <div className="flex flex-col gap-3">
          <div className="grid min-h-[140px] grid-cols-2 gap-3 [&>*]:h-full">
            <StatCard
              label="% GRR Gap"
              value={pctGrrGap(tileRows)}
              kind="percent"
              tone="red-when-positive"
              progress={{
                achieved: grrPct(tileRows),
                target: 0.95,
              }}
            />
            <StatCard
              label="Target GRR Gap"
              value={grrGapDollars(tileRows)}
              kind="currency"
              tone="red-when-positive"
              subtitle="95% × Base GRR − Projected GRR · $ needed to hit 95% retention"
            />
          </div>
          {chartsCollapsed ? null : (
            <CsmQuarterChart
              title="Projected GRR%"
              metric={grrPct}
              chartRows={chartRows}
              formulaRows={tileRows}
              selectedQuarters={selectedQuarters}
              kind="percent"
              target={0.95}
              targetLabel="95% target"
              formula={{
                numerator: { label: "Projected GRR", field: "To_include_in_GRR_v2" },
                denominator: { label: "Base GRR", field: "Base_GRR" },
              }}
            />
          )}
        </div>

        {/* Pod 4 — Book in Risk */}
        <div className="flex flex-col gap-3">
          <div className="grid min-h-[140px] grid-cols-3 gap-3 [&>*]:h-full">
            <StatCard
              label="% Book in Risk"
              value={pctBookInRisk(tileRows)}
              kind="percent"
              tone="red-when-positive"
            />
            <StatCard
              label="FY26 ARR High Risk Renewal"
              value={arrHighRiskRenewal(tileRows)}
              kind="currency"
              tone="red"
            />
            <StatCard
              label="FY26 ARR Expected Churn"
              value={arrExpectedChurn(tileRows)}
              kind="currency"
              tone="red"
            />
          </div>
          {chartsCollapsed ? null : (
            <CsmQuarterChart
              title="% Book in Risk"
              metric={pctBookInRisk}
              chartRows={chartRows}
              formulaRows={tileRows}
              selectedQuarters={selectedQuarters}
              kind="percent"
            />
          )}
        </div>
      </div>
    </section>
  );
}
