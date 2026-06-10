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
import { fmtCurrency, fmtPct } from "@/lib/format";
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

        {/* Pod 4 — Book in Risk. Single card combining the % at risk with
            the $ split (High Risk Renewal + Expected Churn). Same outer
            footprint as the previous 3-card row (min-h-[140px]). */}
        <div className="flex flex-col gap-3">
          <div className="min-h-[140px]">
            <BookInRiskTile
              pct={pctBookInRisk(tileRows)}
              highRisk={arrHighRiskRenewal(tileRows)}
              expectedChurn={arrExpectedChurn(tileRows)}
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

/**
 * Single combined "Book in Risk" tile. Left half = the % at risk; right half
 * = the $ split between High Risk Renewal and Expected Churn. Sized to drop
 * into the same Pod 4 slot the three separate StatCards used to occupy, so
 * the surrounding pod-row layout stays unchanged.
 */
function BookInRiskTile({
  pct,
  highRisk,
  expectedChurn,
}: {
  pct: number;
  highRisk: number;
  expectedChurn: number;
}) {
  const pctTone = Number.isFinite(pct) && pct > 0 ? "text-danger" : "text-ink";
  return (
    <div className="group relative flex h-full overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(15,22,53,0.04)] transition hover:shadow-[0_4px_16px_-6px_rgba(15,22,53,0.08)]">
      {/* Left rail tint signals risk tone without being shouty. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-danger/70"
      />

      {/* Left half — headline % */}
      <div className="flex flex-1 flex-col justify-center px-5 py-4">
        <div className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          % Book in Risk
        </div>
        <div
          className={
            "mt-1 text-[2rem] font-w650 leading-[1.05] tabular-nums tracking-tight " +
            pctTone
          }
        >
          {fmtPct(pct)}
        </div>
        <div className="mt-1 text-[0.7rem] text-ink-subtle">
          ARR at Risk ÷ Renewal Base
        </div>
      </div>

      {/* Divider */}
      <div aria-hidden className="my-3 w-px self-stretch bg-line" />

      {/* Right half — $ split visualized as a stacked contribution bar. */}
      <div className="flex flex-1 flex-col justify-center gap-2 px-5 py-4">
        <RiskContributionBar
          highRisk={highRisk}
          expectedChurn={expectedChurn}
        />
      </div>
    </div>
  );
}

function RiskContributionBar({
  highRisk,
  expectedChurn,
}: {
  highRisk: number;
  expectedChurn: number;
}) {
  const total = (highRisk || 0) + (expectedChurn || 0);
  const segments = [
    {
      key: "high-risk",
      label: "High Risk Renewal",
      value: highRisk,
      color: "#DC2626",
    },
    {
      key: "expected-churn",
      label: "Expected Churn",
      value: expectedChurn,
      color: "#7F1D1D",
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
        <span>ARR at Risk · split</span>
        <span className="tabular-nums text-danger">{fmtCurrency(total)}</span>
      </div>
      {total > 0 ? (
        <div className="flex h-6 w-full overflow-hidden rounded-md bg-gray-100 ring-1 ring-inset ring-line">
          {segments.map((s) => {
            const widthPct = (s.value / total) * 100;
            if (widthPct <= 0) return null;
            const showInline = widthPct >= 25;
            return (
              <div
                key={s.key}
                className="group/seg relative flex items-center justify-center overflow-hidden whitespace-nowrap px-1 text-[0.65rem] font-semibold text-white"
                style={{ width: `${widthPct}%`, backgroundColor: s.color }}
                title={`${s.label}: ${fmtCurrency(s.value)} (${widthPct.toFixed(1)}%)`}
              >
                {showInline ? fmtCurrency(s.value) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-[0.7rem] text-ink-subtle">No ARR at risk</div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.66rem] text-ink-muted">
        {segments.map((s) => {
          const share = total > 0 ? (s.value / total) * 100 : 0;
          return (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span>{s.label}</span>
              <span className="tabular-nums text-ink-subtle">
                {fmtCurrency(s.value)} · {share.toFixed(0)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
