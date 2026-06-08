"""Report 1 derived metrics.

Every formula here mirrors a Salesforce report-level summary formula (the `:SUM`
suffix in the SF source). Replication contract: sum the input columns *first*
across whatever rows the caller provides, then apply the arithmetic. Callers
that want a per-CSM-per-quarter cut should hand each (CSM, Quarter) subgroup
to these functions — see `by_csm_quarter`.

See DASHBOARD_SPEC.md for the canonical metric catalog.
"""

from __future__ import annotations

from typing import Callable

import pandas as pd

from data_loader import CSM_COL, QUARTER_COL

GRR_TARGET = 0.95
NRR_TARGET = 1.10


def _safe_div(num: float, den: float) -> float:
    return num / den if den else float("nan")


# ---- 13 derived metrics ------------------------------------------------------

def grr_pct(df: pd.DataFrame) -> float:
    """Metric 6 — GRR%  =  SUM(To_include_in_GRR_v2) / SUM(Base_GRR)."""
    return _safe_div(df["To_include_in_GRR_v2"].sum(), df["Base_GRR"].sum())


def nrr_pct(df: pd.DataFrame) -> float:
    """Metric 1 — NRR%  =  SUM(To_include_in_NRR) / SUM(NRR_Base)."""
    return _safe_div(df["To_include_in_NRR"].sum(), df["NRR_Base"].sum())


def pct_grr_gap(df: pd.DataFrame) -> float:
    """Metric 9 — % GRR Gap  =  (0.95·SUM(Base_GRR) - SUM(To_include_in_GRR_v2)) / SUM(Base_GRR)."""
    b = df["Base_GRR"].sum()
    return _safe_div(GRR_TARGET * b - df["To_include_in_GRR_v2"].sum(), b)


def grr_gap_dollars(df: pd.DataFrame) -> float:
    """Metric 12 — GRR Gap $  =  0.95·SUM(Base_GRR) - SUM(To_include_in_GRR_v2)."""
    return GRR_TARGET * df["Base_GRR"].sum() - df["To_include_in_GRR_v2"].sum()


def pct_nrr_gap(df: pd.DataFrame) -> float:
    """Metric 11 — % NRR Gap  =  (1.10·SUM(Base_GRR) - SUM(To_include_in_NRR)) / SUM(Base_GRR)."""
    b = df["Base_GRR"].sum()
    return _safe_div(NRR_TARGET * b - df["To_include_in_NRR"].sum(), b)


def nrr_gap_dollars(df: pd.DataFrame) -> float:
    """Metric 13 — NRR Gap $  =  1.10·SUM(Base_GRR) - SUM(To_include_in_NRR)."""
    return NRR_TARGET * df["Base_GRR"].sum() - df["To_include_in_NRR"].sum()


def pct_book_in_risk(df: pd.DataFrame) -> float:
    """Metric 3 — % Book in Risk  =  (SUM(ARR_High_Risk_Renewal) + SUM(ARR_Expected_Churn)) / SUM(NRR_Base)."""
    return _safe_div(
        df["ARR_High_Risk_Renewal"].sum() + df["ARR_Expected_Churn"].sum(),
        df["NRR_Base"].sum(),
    )


def grr_ytd_actuals_pct(df: pd.DataFrame) -> float:
    """Metric 5 — GRR YTD Actuals %  =  SUM(GRR_actuals) / SUM(Base_GRR)."""
    return _safe_div(df["GRR_actuals"].sum(), df["Base_GRR"].sum())


def nrr_ytd_actuals_pct(df: pd.DataFrame) -> float:
    """Metric 7 — NRR YTD Actuals %  =  SUM(NRR_actuals) / SUM(NRR_Base)."""
    return _safe_div(df["NRR_actuals"].sum(), df["NRR_Base"].sum())


def renewal_arr_due_ytd(df: pd.DataFrame) -> float:
    """Metric 8 — Renewal ARR Due YTD  =  SUM(Base_GRR)
       - SUM(ARR_PriorCV_Closed_Renewal_only_c)
       - SUM(ARR_PriorCV_Expected_Churn_c)
       - SUM(ARR_PriorCV_High_Risk_Renewal_c)
       - SUM(ARR_PriorCV_churned_c)."""
    return (
        df["Base_GRR"].sum()
        - df["ARR_PriorCV_Closed_Renewal_only_c"].sum()
        - df["ARR_PriorCV_Expected_Churn_c"].sum()
        - df["ARR_PriorCV_High_Risk_Renewal_c"].sum()
        - df["ARR_PriorCV_churned_c"].sum()
    )


# Raw-field aggregations used directly by widgets A1-5, A1-6, A2-3
def sum_arr_high_risk_renewal(df: pd.DataFrame) -> float:
    return df["ARR_High_Risk_Renewal"].sum()


def sum_arr_expected_churn(df: pd.DataFrame) -> float:
    return df["ARR_Expected_Churn"].sum()


def sum_closed_won_arr(df: pd.DataFrame) -> float:
    return df["closed_won_ARR"].sum()


# ---- Grouping helper ---------------------------------------------------------

MetricFn = Callable[[pd.DataFrame], float]


def by_csm_quarter(
    df: pd.DataFrame,
    metric_fn: MetricFn,
    csm_col: str = CSM_COL,
    quarter_col: str = QUARTER_COL,
) -> pd.DataFrame:
    """Evaluate `metric_fn` on each (CSM, Quarter) subgroup of `df`."""
    rows = []
    for (csm, q), grp in df.groupby([csm_col, quarter_col], dropna=False):
        rows.append({"CSM": csm, "Quarter": q, "value": metric_fn(grp)})
    return pd.DataFrame(rows)
