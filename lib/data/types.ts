export type Row = Record<string, string | number | null>;

export type MetricFn = (rows: Row[]) => number;

export const RENAME_MAP: Record<string, string> = {
  "Projected NRR (numerator)": "To_include_in_NRR",
  "Projected GRR (numerator)": "To_include_in_GRR_v2",
  ARR_PriorCV_Closed_Renewal_only__c: "ARR_PriorCV_Closed_Renewal_only_c",
  ARR_PriorCV_Expected_Churn__c: "ARR_PriorCV_Expected_Churn_c",
  ARR_PriorCV_High_Risk_Renewal__c: "ARR_PriorCV_High_Risk_Renewal_c",
  ARR_PriorCV_churned__c: "ARR_PriorCV_churned_c",
};

export const RAW_NUMERIC_COLS = [
  "To_include_in_NRR",
  "To_include_in_GRR_v2",
  "NRR_Base",
  "Base_GRR",
  "NRR_actuals",
  "GRR_actuals",
  "ARR_High_Risk_Renewal",
  "ARR_Expected_Churn",
  "Expansion_contri",
  "ARR_PriorCV_Closed_Renewal_only_c",
  "ARR_PriorCV_Expected_Churn_c",
  "ARR_PriorCV_High_Risk_Renewal_c",
  "ARR_PriorCV_churned_c",
  "Embedded_renewal_uplift_amt",
  "closed_won_ARR",
  "Upgrade/Downgrade Amount",
] as const;
