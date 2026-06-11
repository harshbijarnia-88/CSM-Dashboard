"use client";

import { ChevronDown, MousePointerClick, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { GRR_TARGET, NRR_TARGET } from "@/lib/constants";
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
import { fmtCurrency, fmtCurrencyFull, fmtPct } from "@/lib/format";
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
  /** Click handler for the GRR Gap tiles — pre-fills the Renewal
   * Opportunities table's status filter with the two at-risk statuses
   * (High Risk Renewal + Expected Churn) and scrolls to that section. */
  onApplyGrrGapFilters?: () => void;
  /** Click handler for the Renewal % Upgrade tile — narrows the renewal
   * table to Likely to Upgrade and scrolls there. */
  onApplyRenewalUpgradeFilter?: () => void;
  /** Click handler for the Standalone Expansion % tile — narrows the
   * expansion table to Commit + Closed Won forecast categories and
   * scrolls to the expansion section (auto-expands the table). */
  onApplyExpansionCommitClosedFilter?: () => void;
  /** Click handler for the % Book in Risk tile — narrows the renewal
   * table to High Risk Renewal + Expected Churn and scrolls there. */
  onApplyBookInRiskFilter?: () => void;
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
  onApplyGrrGapFilters,
  onApplyRenewalUpgradeFilter,
  onApplyExpansionCommitClosedFilter,
  onApplyBookInRiskFilter,
  middleSlot,
}: SectionAProps) {
  const [chartsCollapsed, setChartsCollapsed] = useState(true);
  // Lifted so the panel can render full-width below the pod grid instead
  // of being trapped inside Pod 1's column.
  const [nrrExplainerOpen, setNrrExplainerOpen] = useState(false);
  // Same pattern for the GRR explainer — chip lives in Pod 3, panel
  // renders below the bottom pod row at full width.
  const [grrExplainerOpen, setGrrExplainerOpen] = useState(false);
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
          {nrrExplainerOpen ? null : (
            <NrrGapExplainerChip onOpen={() => setNrrExplainerOpen(true)} />
          )}
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
              onClick={onApplyRenewalUpgradeFilter}
              onClickLabel="Filter the Renewal Opportunities table to Likely to Upgrade"
              subtitle="Embedded Renewal % Uplift"
            />
            <StatCard
              label="Standalone Expansion %"
              value={expansionPctRenewalBase(tileRows)}
              kind="percent"
              tone="green"
              secondary={fmtCurrency(sum(tileRows, "Expansion_contri"))}
              secondaryRaw={sum(tileRows, "Expansion_contri")}
              onClick={onApplyExpansionCommitClosedFilter}
              onClickLabel="Open Expansion Opps · filter to Commit + Closed Won"
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

      {nrrExplainerOpen ? (
        <div className="mt-5">
          <NrrGapExplainerPanel
            tileRows={tileRows}
            onClose={() => setNrrExplainerOpen(false)}
          />
        </div>
      ) : null}

      {middleSlot ? <div className="mt-5">{middleSlot}</div> : null}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Pod 3 — GRR. Both tiles are clickable; clicking drills into
            the renewal opportunities driving the gap (at-risk, expected
            churn, likely-to-downgrade). */}
        <div className="flex flex-col gap-3">
          <div className="grid min-h-[140px] grid-cols-2 gap-3 [&>*]:h-full">
            <StatCard
              label="% GRR Gap"
              value={pctGrrGap(tileRows)}
              kind="percent"
              tone="red-when-positive"
              onClick={onApplyGrrGapFilters}
              onClickLabel="Filter the Renewal Opportunities table to the at-risk statuses"
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
              onClick={onApplyGrrGapFilters}
              onClickLabel="Filter the Renewal Opportunities table to the at-risk statuses"
              subtitle="95% × Base GRR − Projected GRR · $ needed to hit 95% retention"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {grrExplainerOpen ? null : (
              <GrrGapExplainerChip onOpen={() => setGrrExplainerOpen(true)} />
            )}
            {onApplyGrrGapFilters ? (
              <button
                type="button"
                onClick={onApplyGrrGapFilters}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/70 bg-amber-50/70 px-2.5 py-1 text-[0.66rem] leading-snug text-amber-800 transition-colors hover:border-amber-300 hover:bg-amber-50"
              >
                <span aria-hidden className="text-amber-600">💡</span>
                <span>
                  Click a tile to filter renewals · risk + churn + downgrade
                </span>
              </button>
            ) : null}
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
              onClick={onApplyBookInRiskFilter}
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

      {grrExplainerOpen ? (
        <div className="mt-5">
          <GrrGapExplainerPanel
            tileRows={tileRows}
            onClose={() => setGrrExplainerOpen(false)}
          />
        </div>
      ) : null}
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
  onClick,
}: {
  pct: number;
  highRisk: number;
  expectedChurn: number;
  onClick?: () => void;
}) {
  const pctTone = Number.isFinite(pct) && pct > 0 ? "text-danger" : "text-ink";
  return (
    <div className="group relative flex h-full overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_2px_rgba(15,22,53,0.04)] transition hover:shadow-[0_4px_16px_-6px_rgba(15,22,53,0.08)]">
      {/* Left rail tint signals risk tone without being shouty. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-danger/70"
      />

      {/* Left half — headline %. Clickable when wired: drills into the
          renewal opportunities driving the Book-in-Risk metric. Styling
          matches the StatCard onClick pattern used by % GRR Gap / Target
          GRR Gap — subtle brand tint + small MousePointerClick chip in
          the corner. */}
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-label="Filter the Renewal Opportunities table to High Risk Renewal + Expected Churn"
          className="group/click relative flex flex-1 cursor-pointer flex-col justify-center border-r border-brand-200 bg-brand-50/30 px-5 py-4 text-left ring-1 ring-inset ring-brand-100 transition-all hover:-translate-y-[1px] hover:border-brand-400 hover:bg-brand-50/60 hover:ring-brand-200"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute right-2.5 top-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-brand-700 ring-1 ring-brand-200 transition-all group-hover/click:bg-brand-500 group-hover/click:text-white group-hover/click:ring-brand-500"
          >
            <MousePointerClick className="h-3 w-3" strokeWidth={2.25} />
          </span>
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
        </button>
      ) : (
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
      )}

      {/* Divider — only when the left half is read-only (the clickable
          variant carries its own right-edge border for visual separation
          plus the brand tint). */}
      {onClick ? null : (
        <div aria-hidden className="my-3 w-px self-stretch bg-line" />
      )}

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

/**
 * Small toggle that, when expanded, shows an inline NRR-Gap explainer
 * below the NRR Gap tiles. Mirrors the GRR-Gap popover the renewal
 * table renders, but adds a projected-NRR composition bar (renewals vs
 * expansion contribution) so CSMs can see how much of the gap is being
 * filled by expansion vs. coming from renewals.
 */
function NrrGapExplainerChip({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex w-fit items-center gap-1 self-start rounded-full bg-brand-50/60 px-2 py-0.5 text-[0.68rem] font-medium text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-100 hover:ring-brand-300"
    >
      <ChevronDown className="h-3 w-3" />
      NRR Gap Explanation
    </button>
  );
}

function NrrGapExplainerPanel({
  tileRows,
  onClose,
}: {
  tileRows: Row[];
  onClose: () => void;
}) {
  // ── Metrics ──────────────────────────────────────────────────────────
  // Target = 110% × Base_GRR (matches the existing nrrGapDollars formula
  // so the gap value here lines up with the tile above).
  const target = NRR_TARGET * sum(tileRows, "Base_GRR");
  const projected = sum(tileRows, "To_include_in_NRR");
  const gap = target - projected;
  // Composition of Projected NRR: renewal portion + expansion portion.
  // Expansion_contri is the slice attributable to expansion; subtracting
  // it from the total gives the pure-renewal contribution.
  const expansionPortion = sum(tileRows, "Expansion_contri");
  const renewalPortion = Math.max(0, projected - expansionPortion);
  const compositionTotal = Math.max(1, renewalPortion + expansionPortion);
  const renewalSharePct = (renewalPortion / compositionTotal) * 100;
  const expansionSharePct = (expansionPortion / compositionTotal) * 100;

  // ── At-risk pool ─────────────────────────────────────────────────────
  // Two derivations from the same row scan:
  //   LEFT side ("Opportunities driving the NRR gap") — stage-agnostic.
  //     Full Prior CV for High Risk + Expected Churn (any stage), and
  //     full |Upgrade/Downgrade Amount| for Likely to Downgrade (any
  //     stage). Informational, shows the total exposure.
  //   RIGHT side (smart insight) — open stages only, and split by
  //     recoverability: High Risk Renewal is treated as recoverable;
  //     Expected Churn is treated as a sunk loss (cannot be saved). The
  //     recoverable bucket is what we use to compute the residual gap
  //     that has to be closed by new expansion.
  const renewalRows = tileRows.filter(
    (r) => String(r["Type"] ?? "").trim() === "Renewals",
  );
  const openRenewalStages = new Set([
    "Renewal Anticipation",
    "Proposal Discussion",
    "Renewal Confirmation",
  ]);
  const num = (v: unknown) => {
    const n = parseFloat(String(v ?? "").replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  // Stage-agnostic — LEFT side displays.
  let riskPriorCv = 0;
  let riskCount = 0;
  let downgradeSum = 0;
  let downgradeCount = 0;
  // Open-stage, split by recoverability — RIGHT side smart insight.
  let recoverablePool = 0; // High Risk Renewal, open stages
  let recoverableCount = 0;
  let unrecoverablePool = 0; // Expected Churn, open stages
  let unrecoverableCount = 0;

  for (const r of renewalRows) {
    const status = String(r["Renewal Status"] ?? "").trim();
    const stage = String(r["Stage"] ?? "").trim();
    const priorCv = num(r["Prior Contract Value"]);
    const ud = num(r["Upgrade/Downgrade Amount"]);

    if (status === "High Risk Renewal" || status === "Expected Churn") {
      riskPriorCv += priorCv;
      riskCount += 1;
    } else if (status === "Likely to Downgrade") {
      downgradeSum += ud;
      downgradeCount += 1;
    }

    if (openRenewalStages.has(stage)) {
      if (status === "High Risk Renewal") {
        recoverablePool += priorCv;
        recoverableCount += 1;
      } else if (status === "Expected Churn") {
        unrecoverablePool += priorCv;
        unrecoverableCount += 1;
      }
    }
  }
  const downgradePositive = Math.abs(downgradeSum);
  const atRiskTotal = riskPriorCv + downgradePositive;
  const actionableAtRiskTotal = recoverablePool + unrecoverablePool;
  // After recovering everything we can (High Risk only), what's left to
  // close with new expansion? Floored at 0 because if the recoverable
  // pool already exceeds the gap, no extra expansion is needed.
  const expansionStillNeeded = Math.max(0, gap - recoverablePool);

  return (
    <div className="relative w-full rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100/40 p-4 shadow-sm ring-1 ring-brand-100">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close NRR Gap explainer"
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm ring-1 ring-brand-300 transition-all hover:bg-brand-100 hover:text-brand-800 hover:ring-brand-500"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>

      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base">💡</span>
        <div className="text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-700">
          NRR Gap Explanation
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
      {/* Target − Projected = Gap */}
      <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
        <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
          NRR target − Projected = Gap
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          <NrrMetricCell
            label="Target (110% × Base)"
            value={target}
            tone="muted"
          />
          <NrrMetricCell label="Projected NRR" value={projected} tone="muted" />
          <NrrMetricCell label="NRR Gap" value={gap} tone="danger" />
        </div>
      </div>

      {/* Composition bar — renewals vs expansion */}
      <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
        <div className="flex items-baseline justify-between">
          <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
            Projected NRR composition
          </div>
          <DollarWithHoverFull
            value={projected}
            className="text-[0.68rem] tabular-nums text-ink-subtle"
            position="above"
          />
        </div>
        {projected > 0 ? (
          <>
            <div className="mt-2 flex h-5 w-full overflow-hidden rounded-md ring-1 ring-inset ring-line">
              <div
                className="flex items-center justify-center bg-brand-500 text-[0.6rem] font-semibold text-white"
                style={{ width: `${renewalSharePct}%` }}
                title={fmtCurrencyFull(renewalPortion)}
              >
                {renewalSharePct >= 18 ? (
                  <>
                    Renewals · {fmtCurrency(renewalPortion)}
                  </>
                ) : null}
              </div>
              <div
                className="flex items-center justify-center bg-success text-[0.6rem] font-semibold text-white"
                style={{ width: `${expansionSharePct}%` }}
                title={fmtCurrencyFull(expansionPortion)}
              >
                {expansionSharePct >= 18 ? (
                  <>Expansion · {fmtCurrency(expansionPortion)}</>
                ) : null}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.66rem] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full bg-brand-500"
                />
                Renewals ·{" "}
                <DollarWithHoverFull value={renewalPortion} /> (
                {renewalSharePct.toFixed(0)}%)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full bg-success"
                />
                Expansion ·{" "}
                <DollarWithHoverFull value={expansionPortion} /> (
                {expansionSharePct.toFixed(0)}%)
              </span>
            </div>
            <div className="mt-1 text-[0.66rem] italic text-ink-subtle">
              Expansion is filling{" "}
              <span className="font-semibold not-italic text-success">
                {expansionSharePct.toFixed(0)}%
              </span>{" "}
              of projected NRR. The rest comes from renewals.
            </div>
          </>
        ) : (
          <div className="mt-2 text-[0.7rem] text-ink-subtle">
            No projected NRR in the current selection.
          </div>
        )}
      </div>

      {/* At-risk pool driving the gap */}
      <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
        <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
          Opportunities driving the NRR gap
        </div>
        <div className="mt-1.5 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink-muted">
              Prior CV · High Risk + Expected Churn
            </span>
            <span className="shrink-0 tabular-nums">
              <DollarWithHoverFull
                value={riskPriorCv}
                className="font-medium text-ink"
                position="above"
              />
              <span className="ml-1 text-ink-subtle">
                ({riskCount} opp{riskCount === 1 ? "" : "s"})
              </span>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink-muted">
              Downgrade $ · Likely to Downgrade
            </span>
            <span className="shrink-0 tabular-nums">
              <DollarWithHoverFull
                value={downgradePositive}
                className="font-medium text-ink"
                position="above"
              />
              <span className="ml-1 text-ink-subtle">
                ({downgradeCount} opp{downgradeCount === 1 ? "" : "s"})
              </span>
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between border-t border-brand-100 pt-2">
            <span className="text-[0.7rem] font-semibold text-ink">
              Total dollar amount across these renewal opportunities
            </span>
            <DollarWithHoverFull
              value={atRiskTotal}
              className="text-[1rem] font-w650 tabular-nums text-ink"
              position="above"
            />
          </div>
        </div>
      </div>
      </div>

      {/* Right column — smart insight: paths to close the gap */}
      <NrrGapPathsInsight
        gap={gap}
        actionableAtRiskTotal={actionableAtRiskTotal}
        recoverablePool={recoverablePool}
        recoverableCount={recoverableCount}
        unrecoverablePool={unrecoverablePool}
        unrecoverableCount={unrecoverableCount}
        expansionStillNeeded={expansionStillNeeded}
      />
      </div>
    </div>
  );
}

/**
 * Right-side smart-insight panel for the NRR Gap explainer. Surfaces the
 * two coverage paths (convert at-risk renewals, drive more expansion) and
 * a hybrid scenario so a CSM can quickly see what closing the gap would
 * actually take. All amounts are derived from current-selection metrics
 * passed in from the parent — no extra rollups, no fetches.
 */
function NrrGapPathsInsight({
  gap,
  actionableAtRiskTotal,
  recoverablePool,
  recoverableCount,
  unrecoverablePool,
  unrecoverableCount,
  expansionStillNeeded,
}: {
  gap: number;
  actionableAtRiskTotal: number;
  recoverablePool: number;
  recoverableCount: number;
  unrecoverablePool: number;
  unrecoverableCount: number;
  expansionStillNeeded: number;
}) {
  if (gap <= 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
          <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
            Closing the NRR gap
          </div>
          <div className="mt-2 text-[0.78rem] text-ink-muted">
            No NRR gap in the current selection — projected NRR is already at
            or above the 110% target.
          </div>
        </div>
      </div>
    );
  }

  // Recoverable pool alone exceeds the gap — surface that explicitly so
  // the CSM knows expansion isn't strictly required.
  const recoveryClosesGap = recoverablePool >= gap;

  return (
    <div className="flex flex-col gap-3">
      {/* Header — gap callout */}
      <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
            Closing the gap
          </div>
          <DollarWithHoverFull
            value={gap}
            className="text-[0.95rem] font-w650 tabular-nums text-danger"
            position="above"
          />
        </div>
        <div className="mt-1 text-[0.7rem] text-ink-subtle">
          Counting only open-stage renewal opps (Renewal Anticipation,
          Proposal Discussion, Renewal Confirmation).
        </div>
      </div>

      {/* Step 1 — At-risk renewals split by recoverability */}
      <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[0.62rem] font-bold text-brand-700"
          >
            1
          </span>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink">
            At-risk renewals
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink-muted">Total at-risk renewal pool</span>
            <DollarWithHoverFull
              value={actionableAtRiskTotal}
              className="shrink-0 font-medium tabular-nums text-ink"
              position="above"
            />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-brand-100 pt-2">
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-success"
              />
              High Risk Renewal · <span className="text-success">recoverable</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <DollarWithHoverFull
                value={recoverablePool}
                className="font-medium text-ink"
                position="above"
              />
              <span className="ml-1 text-ink-subtle">
                ({recoverableCount} opp{recoverableCount === 1 ? "" : "s"})
              </span>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-danger"
              />
              Expected Churn ·{" "}
              <span className="text-danger">assumed unrecoverable</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <DollarWithHoverFull
                value={unrecoverablePool}
                className="font-medium text-ink"
                position="above"
              />
              <span className="ml-1 text-ink-subtle">
                ({unrecoverableCount} opp{unrecoverableCount === 1 ? "" : "s"})
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Step 2 — Residual expansion needed after recovering High Risk */}
      <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-[0.62rem] font-bold text-success"
          >
            2
          </span>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink">
            Additional expansion needed
          </div>
        </div>
        {recoveryClosesGap ? (
          <div className="mt-2 text-[0.72rem] leading-snug text-ink-muted">
            Saving the{" "}
            <DollarWithHoverFull
              value={recoverablePool}
              className="font-semibold text-ink"
            />{" "}
            of High Risk Renewal opps alone is enough to close the{" "}
            <DollarWithHoverFull
              value={gap}
              className="font-semibold text-ink"
            />{" "}
            gap — no additional expansion required.
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            <div className="text-[0.72rem] leading-snug text-ink-muted">
              If you save the{" "}
              <DollarWithHoverFull
                value={recoverablePool}
                className="font-semibold text-ink"
              />{" "}
              from High Risk Renewal, you'd still need this much in additional
              expansion to fully close the{" "}
              <DollarWithHoverFull
                value={gap}
                className="font-semibold text-ink"
              />{" "}
              gap:
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-brand-100 pt-2">
              <span className="text-[0.72rem] font-semibold text-ink">
                Additional expansion required
              </span>
              <DollarWithHoverFull
                value={expansionStillNeeded}
                className="text-[1rem] font-w650 tabular-nums text-success"
                position="above"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GrrGapExplainerChip({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex w-fit items-center gap-1 self-start rounded-full bg-brand-50/60 px-2 py-0.5 text-[0.68rem] font-medium text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-100 hover:ring-brand-300"
    >
      <ChevronDown className="h-3 w-3" />
      GRR Gap Explanation
    </button>
  );
}

/**
 * Full-width GRR-Gap explainer. Mirrors the NRR explainer's two-column
 * layout (math + "opportunities driving the gap" on the left, smart
 * insight on the right) but the right-side action panel is
 * GRR-specific: GRR is pure retention math, so the only lever to close
 * the gap is converting open High Risk Renewal opps back to renewed.
 * Expansion does not contribute to GRR — the panel explicitly calls
 * that out so a CSM doesn't try to fix retention with new bookings.
 */
function GrrGapExplainerPanel({
  tileRows,
  onClose,
}: {
  tileRows: Row[];
  onClose: () => void;
}) {
  const target = GRR_TARGET * sum(tileRows, "Base_GRR");
  const projected = sum(tileRows, "To_include_in_GRR_v2");
  const gap = target - projected;

  // ── At-risk pool — same dual-derivation pattern as the NRR explainer.
  //   LEFT side: stage-agnostic full Prior CV + full |downgrade $|.
  //   RIGHT side: open stages only, split by recoverability (High Risk
  //     = recoverable; Expected Churn = assumed unrecoverable).
  const renewalRows = tileRows.filter(
    (r) => String(r["Type"] ?? "").trim() === "Renewals",
  );
  const openRenewalStages = new Set([
    "Renewal Anticipation",
    "Proposal Discussion",
    "Renewal Confirmation",
  ]);
  const num = (v: unknown) => {
    const n = parseFloat(String(v ?? "").replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  let riskPriorCv = 0;
  let riskCount = 0;
  let downgradeSum = 0;
  let downgradeCount = 0;
  let recoverablePool = 0;
  let recoverableCount = 0;
  let unrecoverablePool = 0;
  let unrecoverableCount = 0;

  for (const r of renewalRows) {
    const status = String(r["Renewal Status"] ?? "").trim();
    const stage = String(r["Stage"] ?? "").trim();
    const priorCv = num(r["Prior Contract Value"]);
    const ud = num(r["Upgrade/Downgrade Amount"]);
    if (status === "High Risk Renewal" || status === "Expected Churn") {
      riskPriorCv += priorCv;
      riskCount += 1;
    } else if (status === "Likely to Downgrade") {
      downgradeSum += ud;
      downgradeCount += 1;
    }
    if (openRenewalStages.has(stage)) {
      if (status === "High Risk Renewal") {
        recoverablePool += priorCv;
        recoverableCount += 1;
      } else if (status === "Expected Churn") {
        unrecoverablePool += priorCv;
        unrecoverableCount += 1;
      }
    }
  }
  const downgradePositive = Math.abs(downgradeSum);
  const atRiskTotal = riskPriorCv + downgradePositive;
  const actionableAtRiskTotal = recoverablePool + unrecoverablePool;
  // Residual gap after saving everything we can — for GRR there is NO
  // expansion lever, so this number is the unavoidable shortfall.
  const residualGap = Math.max(0, gap - recoverablePool);

  return (
    <div className="relative w-full rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-brand-100/40 p-4 shadow-sm ring-1 ring-brand-100">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close GRR Gap explainer"
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-brand-700 shadow-sm ring-1 ring-brand-300 transition-all hover:bg-brand-100 hover:text-brand-800 hover:ring-brand-500"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>

      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base">💡</span>
        <div className="text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-brand-700">
          GRR Gap Explanation
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          {/* Target − Projected = Gap */}
          <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
            <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
              GRR target − Projected = Gap
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <NrrMetricCell
                label="Target (95% × Base)"
                value={target}
                tone="muted"
              />
              <NrrMetricCell
                label="Projected GRR"
                value={projected}
                tone="muted"
              />
              <NrrMetricCell label="GRR Gap" value={gap} tone="danger" />
            </div>
          </div>

          {/* Opportunities driving the GRR gap — stage-agnostic */}
          <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
            <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
              Opportunities driving the GRR gap
            </div>
            <div className="mt-1.5 flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ink-muted">
                  Prior CV · High Risk + Expected Churn
                </span>
                <span className="shrink-0 tabular-nums">
                  <DollarWithHoverFull
                    value={riskPriorCv}
                    className="font-medium text-ink"
                    position="above"
                  />
                  <span className="ml-1 text-ink-subtle">
                    ({riskCount} opp{riskCount === 1 ? "" : "s"})
                  </span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ink-muted">
                  Downgrade $ · Likely to Downgrade
                </span>
                <span className="shrink-0 tabular-nums">
                  <DollarWithHoverFull
                    value={downgradePositive}
                    className="font-medium text-ink"
                    position="above"
                  />
                  <span className="ml-1 text-ink-subtle">
                    ({downgradeCount} opp{downgradeCount === 1 ? "" : "s"})
                  </span>
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between border-t border-brand-100 pt-2">
                <span className="text-[0.7rem] font-semibold text-ink">
                  Total dollar amount across these renewal opportunities
                </span>
                <DollarWithHoverFull
                  value={atRiskTotal}
                  className="text-[1rem] font-w650 tabular-nums text-ink"
                  position="above"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right column — smart insight: the GRR-specific path */}
        <GrrGapPathInsight
          gap={gap}
          actionableAtRiskTotal={actionableAtRiskTotal}
          recoverablePool={recoverablePool}
          recoverableCount={recoverableCount}
          unrecoverablePool={unrecoverablePool}
          unrecoverableCount={unrecoverableCount}
          residualGap={residualGap}
        />
      </div>
    </div>
  );
}

/**
 * Right-side smart-insight panel for the GRR Gap explainer. Single-lever
 * version of the NRR one: GRR cannot be improved by expansion, so the
 * panel surfaces (1) how much of the gap is actually recoverable via
 * High Risk Renewal saves, and (2) the unavoidable shortfall (Expected
 * Churn + whatever High Risk can't cover).
 */
function GrrGapPathInsight({
  gap,
  actionableAtRiskTotal,
  recoverablePool,
  recoverableCount,
  unrecoverablePool,
  unrecoverableCount,
  residualGap,
}: {
  gap: number;
  actionableAtRiskTotal: number;
  recoverablePool: number;
  recoverableCount: number;
  unrecoverablePool: number;
  unrecoverableCount: number;
  residualGap: number;
}) {
  if (gap <= 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
          <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
            Closing the GRR gap
          </div>
          <div className="mt-2 text-[0.78rem] text-ink-muted">
            No GRR gap in the current selection — projected GRR is already at
            or above the 95% target.
          </div>
        </div>
      </div>
    );
  }

  const recoveryClosesGap = recoverablePool >= gap;
  const recoveryCapped = Math.min(recoverablePool, gap);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
            Closing the gap
          </div>
          <DollarWithHoverFull
            value={gap}
            className="text-[0.95rem] font-w650 tabular-nums text-danger"
            position="above"
          />
        </div>
        <div className="mt-1 text-[0.7rem] text-ink-subtle">
          GRR is pure retention — the only lever is converting open High Risk
          Renewal opps. Expansion does not improve GRR.
        </div>
      </div>

      {/* Step 1 — At-risk renewals split by recoverability (open stages) */}
      <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-[0.62rem] font-bold text-brand-700"
          >
            1
          </span>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink">
            At-risk renewals · open stages
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink-muted">Total at-risk renewal pool</span>
            <DollarWithHoverFull
              value={actionableAtRiskTotal}
              className="shrink-0 font-medium tabular-nums text-ink"
              position="above"
            />
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-brand-100 pt-2">
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-success"
              />
              High Risk Renewal · <span className="text-success">recoverable</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <DollarWithHoverFull
                value={recoverablePool}
                className="font-medium text-ink"
                position="above"
              />
              <span className="ml-1 text-ink-subtle">
                ({recoverableCount} opp{recoverableCount === 1 ? "" : "s"})
              </span>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-ink-muted">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-danger"
              />
              Expected Churn ·{" "}
              <span className="text-danger">assumed unrecoverable</span>
            </span>
            <span className="shrink-0 tabular-nums">
              <DollarWithHoverFull
                value={unrecoverablePool}
                className="font-medium text-ink"
                position="above"
              />
              <span className="ml-1 text-ink-subtle">
                ({unrecoverableCount} opp{unrecoverableCount === 1 ? "" : "s"})
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Step 2 — Net outcome of saving High Risk Renewal */}
      <div className="rounded-lg border border-brand-100 bg-white/70 p-3 text-[0.74rem]">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-[0.62rem] font-bold text-success"
          >
            2
          </span>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink">
            Save High Risk Renewal opps
          </div>
        </div>
        {recoveryClosesGap ? (
          <div className="mt-2 text-[0.72rem] leading-snug text-ink-muted">
            Saving the{" "}
            <DollarWithHoverFull
              value={recoverablePool}
              className="font-semibold text-ink"
            />{" "}
            of High Risk Renewal opps is enough to close the{" "}
            <DollarWithHoverFull
              value={gap}
              className="font-semibold text-ink"
            />{" "}
            gap entirely. Focus action on these {recoverableCount} opp
            {recoverableCount === 1 ? "" : "s"}.
          </div>
        ) : (
          <div className="mt-2 flex flex-col gap-1.5">
            <div className="text-[0.72rem] leading-snug text-ink-muted">
              Saving every{" "}
              <DollarWithHoverFull
                value={recoverablePool}
                className="font-semibold text-ink"
              />{" "}
              of recoverable High Risk Renewal closes only{" "}
              <DollarWithHoverFull
                value={recoveryCapped}
                className="font-semibold text-ink"
              />{" "}
              of the gap.
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-brand-100 pt-2">
              <span className="text-[0.72rem] font-semibold text-ink">
                Unavoidable shortfall · cannot be filled by expansion
              </span>
              <DollarWithHoverFull
                value={residualGap}
                className="text-[1rem] font-w650 tabular-nums text-danger"
                position="above"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NrrMetricCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "danger";
}) {
  const valueClass =
    tone === "danger"
      ? "text-danger"
      : "text-ink";
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.62rem] uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </span>
      <DollarWithHoverFull
        value={value}
        className={`text-[0.95rem] font-w650 tabular-nums ${valueClass}`}
      />
    </div>
  );
}

/**
 * Inline currency display with an instant-feedback hover popover showing
 * the full-precision $ value (e.g. "$4,234,567" beneath the abbreviated
 * "$4.2M"). Uses CSS group-hover so the tooltip appears the moment the
 * cursor enters — no native title delay. The popover is positioned BELOW
 * the trigger by default; pass `position="above"` if it'd be clipped by
 * something downstream. The trigger is a dotted underline + cursor-help
 * so the hover affordance is visible.
 */
function DollarWithHoverFull({
  value,
  className,
  position = "below",
}: {
  value: number;
  className?: string;
  position?: "above" | "below";
}) {
  const wrapperClass = "group/dollar relative inline-flex";
  const triggerClass =
    "cursor-help underline decoration-dotted decoration-ink-subtle/40 underline-offset-2 " +
    (className ?? "");
  const tooltipClass =
    position === "below"
      ? "left-1/2 top-full mt-1.5 -translate-x-1/2"
      : "left-1/2 bottom-full mb-1.5 -translate-x-1/2";
  const tailClass =
    position === "below"
      ? "absolute -top-px left-1/2 -mt-1 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-ink"
      : "absolute -bottom-px left-1/2 -mb-1 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-ink";
  return (
    <span className={wrapperClass}>
      <span className={triggerClass}>{fmtCurrency(value)}</span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-30 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[0.7rem] font-medium tabular-nums text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover/dollar:opacity-100 group-focus-within/dollar:opacity-100 ${tooltipClass}`}
      >
        {fmtCurrencyFull(value)}
        <span aria-hidden className={tailClass} />
      </span>
    </span>
  );
}
