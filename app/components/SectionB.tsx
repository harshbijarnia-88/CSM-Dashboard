"use client";

import { useState } from "react";
import type { Row } from "@/lib/data/types";
import {
  arrInRisk,
  closedLostRenewal,
  closedWonExpansion,
  closedWonRenewal,
  grrYtdActualsPct,
  nrrYtdActualsPct,
  renewalArrDueYtd,
} from "@/lib/metrics";
import { fmtCurrency } from "@/lib/format";
import { ChartCollapseToggle } from "./ChartCollapseToggle";
import { CsmQuarterChart } from "./CsmQuarterChart";
import { SectionHeader } from "./SectionHeader";
import { StatCard } from "./StatCard";

export type SectionBProps = {
  tileRows: Row[];
  chartRows: Row[];
  selectedQuarters: string[];
};

export function SectionB({ tileRows, chartRows, selectedQuarters }: SectionBProps) {
  const [chartsCollapsed, setChartsCollapsed] = useState(true);
  const grrActualsPct = grrYtdActualsPct(tileRows);
  const nrrActualsPct = nrrYtdActualsPct(tileRows);
  const cwRenewal = closedWonRenewal(tileRows);
  const cwExpansion = closedWonExpansion(tileRows);
  return (
    <section className="rounded-2xl bg-white/40 p-5 ring-1 ring-line/60 backdrop-blur-sm">
      <SectionHeader
        subtitle="Year-to-date booked renewal and expansion performance"
        action={
          <ChartCollapseToggle
            collapsed={chartsCollapsed}
            onToggle={() => setChartsCollapsed((c) => !c)}
          />
        }
      >
        NRR & GRR Actuals
      </SectionHeader>

      {/* Row 1 — % actuals tiles only (gap $ tiles removed per request).
            NRR on the left, GRR on the right to mirror Projected & Gaps. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <StatCard
          label="% NRR Actuals"
          value={nrrActualsPct}
          kind="percent"
          tone={nrrActualsPct >= 1.1 ? "green" : "red"}
          progress={{ achieved: nrrActualsPct, target: 1.1, verb: "achieved" }}
        />
        <StatCard
          label="% GRR Actuals"
          value={grrActualsPct}
          kind="percent"
          tone={grrActualsPct >= 0.95 ? "green" : "red"}
          progress={{ achieved: grrActualsPct, target: 0.95, verb: "achieved" }}
        />
      </div>

      {/* Row 2 — existing $ summary tiles in a single line. */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Renewal Remaining"
          value={renewalArrDueYtd(tileRows)}
          kind="currency"
          tone="neutral"
          subtitle="Excludes ARR in Risk · prior contract value"
        />
        <StatCard
          label="Closed-Won (Renewal + Expansion)"
          value={cwRenewal + cwExpansion}
          kind="currency"
          tone="green"
          subtitle={`${fmtCurrency(cwRenewal)} renewals · ${fmtCurrency(cwExpansion)} expansion`}
        />
        <StatCard
          label="Closed-Lost Renewal"
          value={closedLostRenewal(tileRows)}
          kind="currency"
          tone="red"
          subtitle="Prior contract value of churned renewals"
        />
        <StatCard
          label="$ Amount in Risk"
          value={arrInRisk(tileRows)}
          kind="currency"
          tone="red"
          subtitle="High Risk Renewal + Expected Churn ARR"
        />
      </div>

      {/* Row 3 — NRR% / GRR% per-CSM charts (NRR left, GRR right to mirror
            the Row 1 tile order). */}
      {chartsCollapsed ? null : (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <CsmQuarterChart
            title="NRR% Actuals"
            metric={nrrYtdActualsPct}
            chartRows={chartRows}
              formulaRows={tileRows}
            selectedQuarters={selectedQuarters}
            kind="percent"
            target={1.1}
            targetLabel="110% target"
            formula={{
              numerator: { label: "NRR Actuals", field: "NRR_actuals" },
              denominator: { label: "NRR Base", field: "NRR_Base" },
            }}
          />
          <CsmQuarterChart
            title="GRR% Actuals"
            metric={grrYtdActualsPct}
            chartRows={chartRows}
              formulaRows={tileRows}
            selectedQuarters={selectedQuarters}
            kind="percent"
            target={0.95}
            targetLabel="95% target"
            formula={{
              numerator: { label: "GRR Actuals", field: "GRR_actuals" },
              denominator: { label: "Base GRR", field: "Base_GRR" },
            }}
          />
        </div>
      )}
    </section>
  );
}
