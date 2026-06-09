import { GRR_TARGET, NRR_TARGET } from "./constants";
import type { Row } from "./data/types";

export const sum = (rows: Row[], col: string): number =>
  rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0);

export const safeDiv = (a: number, b: number): number => (b === 0 ? NaN : a / b);

// 1. NRR%
export const nrrPct = (rows: Row[]) =>
  safeDiv(sum(rows, "To_include_in_NRR"), sum(rows, "NRR_Base"));

// 2. Expansion % of Renewal Base
export const expansionPctRenewalBase = (rows: Row[]) =>
  safeDiv(sum(rows, "Expansion_contri"), sum(rows, "NRR_Base"));

// 3. % Book in Risk
export const pctBookInRisk = (rows: Row[]) =>
  safeDiv(
    sum(rows, "ARR_High_Risk_Renewal") + sum(rows, "ARR_Expected_Churn"),
    sum(rows, "NRR_Base"),
  );

// 4. Renewal ARR Due (full year)
export const renewalArrDue = (rows: Row[]) =>
  sum(rows, "Base_GRR") - sum(rows, "NRR_actuals");

// 5. GRR YTD Actuals %
export const grrYtdActualsPct = (rows: Row[]) =>
  safeDiv(sum(rows, "GRR_actuals"), sum(rows, "Base_GRR"));

// 6. GRR%
export const grrPct = (rows: Row[]) =>
  safeDiv(sum(rows, "To_include_in_GRR_v2"), sum(rows, "Base_GRR"));

// 7. NRR YTD Actuals %
export const nrrYtdActualsPct = (rows: Row[]) =>
  safeDiv(sum(rows, "NRR_actuals"), sum(rows, "NRR_Base"));

// 8. Renewal ARR Due YTD
export const renewalArrDueYtd = (rows: Row[]) =>
  sum(rows, "Base_GRR") -
  sum(rows, "ARR_PriorCV_Closed_Renewal_only_c") -
  sum(rows, "ARR_PriorCV_Expected_Churn_c") -
  sum(rows, "ARR_PriorCV_High_Risk_Renewal_c") -
  sum(rows, "ARR_PriorCV_churned_c");

// 9. % GRR Gap
export const pctGrrGap = (rows: Row[]) => {
  const b = sum(rows, "Base_GRR");
  return safeDiv(GRR_TARGET * b - sum(rows, "To_include_in_GRR_v2"), b);
};

// 10. Embedded Renewal Uplift %
export const embeddedRenewalUpliftPct = (rows: Row[]) =>
  safeDiv(sum(rows, "Embedded_renewal_uplift_amt"), sum(rows, "Base_GRR"));

// 11. % NRR Gap
export const pctNrrGap = (rows: Row[]) => {
  const b = sum(rows, "Base_GRR");
  return safeDiv(NRR_TARGET * b - sum(rows, "To_include_in_NRR"), b);
};

// 12. GRR Gap ($)
export const grrGapDollars = (rows: Row[]) =>
  GRR_TARGET * sum(rows, "Base_GRR") - sum(rows, "To_include_in_GRR_v2");

// 13. NRR Gap ($)
export const nrrGapDollars = (rows: Row[]) =>
  NRR_TARGET * sum(rows, "Base_GRR") - sum(rows, "To_include_in_NRR");

// $ remaining to hit GRR target based on YTD GRR Actuals
export const grrActualsGapDollars = (rows: Row[]) =>
  GRR_TARGET * sum(rows, "Base_GRR") - sum(rows, "GRR_actuals");

// $ remaining to hit NRR target based on YTD NRR Actuals
export const nrrActualsGapDollars = (rows: Row[]) =>
  NRR_TARGET * sum(rows, "NRR_Base") - sum(rows, "NRR_actuals");

export const arrHighRiskRenewal = (rows: Row[]) =>
  sum(rows, "ARR_High_Risk_Renewal");

export const arrExpectedChurn = (rows: Row[]) =>
  sum(rows, "ARR_Expected_Churn");

// Total $ at risk — High Risk Renewal ARR + Expected Churn ARR. This is the
// numerator of `pctBookInRisk` surfaced as a standalone aggregate.
export const arrInRisk = (rows: Row[]) =>
  sum(rows, "ARR_High_Risk_Renewal") + sum(rows, "ARR_Expected_Churn");

export const closedWonRenewal = (rows: Row[]) => sum(rows, "closed_won_ARR");

// Expansion closed-won = NRR Actuals − Closed-Won Renewal. NRR_actuals is the
// total closed-won ARR booked (renewal + expansion); closed_won_ARR is the
// renewals-only slice. Computed from the same actuals columns the NRR%
// numerator uses so the tile's combined value always reconciles with the
// "NRR Actuals" number shown elsewhere in this section.
export const closedWonExpansion = (rows: Row[]) =>
  Math.max(0, sum(rows, "NRR_actuals") - sum(rows, "closed_won_ARR"));

// Prior-contract-value of opps already lost — the dollar leakage from
// renewals that did not renew.
export const closedLostRenewal = (rows: Row[]) =>
  sum(rows, "ARR_PriorCV_churned_c");
