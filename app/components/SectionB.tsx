"use client";

import { useState } from "react";
import type { Row } from "@/lib/data/types";
import {
  arrInRisk,
  closedLostRenewal,
  closedWonRenewal,
  grrYtdActualsPct,
  nrrYtdActualsPct,
  renewalArrDueYtd,
} from "@/lib/metrics";
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
  const [chartsCollapsed, setChartsCollapsed] = useState(false);
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

      {/* Two pods, each: cards on top, chart filling below. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Pod 1 — GRR actuals + Renewal Remaining / Closed-Won */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Renewal Remaining"
              value={renewalArrDueYtd(tileRows)}
              kind="currency"
              tone="neutral"
              subtitle="Excludes ARR in Risk · prior contract value"
            />
            <StatCard
              label="Closed-Won Renewal"
              value={closedWonRenewal(tileRows)}
              kind="currency"
              tone="green"
            />
          </div>
          {chartsCollapsed ? null : (
            <CsmQuarterChart
              title="GRR% Actuals"
              metric={grrYtdActualsPct}
              chartRows={chartRows}
              selectedQuarters={selectedQuarters}
              kind="percent"
              target={0.95}
              targetLabel="95% target"
              formula={{
                numerator: { label: "GRR Actuals", field: "GRR_actuals" },
                denominator: { label: "Base GRR", field: "Base_GRR" },
              }}
            />
          )}
        </div>

        {/* Pod 2 — NRR actuals + Closed-Lost */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
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
          {chartsCollapsed ? null : (
            <CsmQuarterChart
              title="NRR% Actuals"
              metric={nrrYtdActualsPct}
              chartRows={chartRows}
              selectedQuarters={selectedQuarters}
              kind="percent"
              target={1.1}
              targetLabel="110% target"
              formula={{
                numerator: { label: "NRR Actuals", field: "NRR_actuals" },
                denominator: { label: "NRR Base", field: "NRR_Base" },
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
