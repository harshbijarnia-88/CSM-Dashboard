"""Load the Salesforce-linked Google Sheet and normalize column names.

The Sheet exposes the SF report row-level fields under names that mostly mirror
the API names. We rename a small subset to canonical names referenced by the
formulas in `metrics.py`; the rest pass through unchanged.
"""

from __future__ import annotations

import io

import pandas as pd
import requests
import streamlit as st


SHEET_ID = "1_mnKGada5DP-0uAWJ_Av9RJH1ed1bseQozYVvDEA72o"
GID = 0
# Use the gviz endpoint instead of /export?format=csv — the latter 307-redirects
# to a signed doc-04-2o-sheets.googleusercontent.com URL that rejects plain
# unauthenticated follow-ups. gviz returns CSV directly from docs.google.com.
SHEET_CSV_URL = (
    f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq"
    f"?tqx=out:csv&gid={GID}"
)

# Sheet column header  ->  canonical name used in metric formulas.
# Only fields whose Sheet header differs from the canonical name appear here.
COLUMN_MAP: dict[str, str] = {
    "Projected NRR (numerator)": "To_include_in_NRR",
    "Projected GRR (numerator)": "To_include_in_GRR_v2",
    "ARR_PriorCV_Closed_Renewal_only__c": "ARR_PriorCV_Closed_Renewal_only_c",
    "ARR_PriorCV_Expected_Churn__c": "ARR_PriorCV_Expected_Churn_c",
    "ARR_PriorCV_High_Risk_Renewal__c": "ARR_PriorCV_High_Risk_Renewal_c",
    "ARR_PriorCV_churned__c": "ARR_PriorCV_churned_c",
}

# All 15 canonical numeric input fields driving the metric catalog.
NUMERIC_FIELDS: list[str] = [
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
]

CSM_COL = "Opportunity Owner"
QUARTER_COL = "Opp_closed_date_quarter"

# The dashboard is scoped to the active CSM book of business. Opportunities
# owned by anyone outside this list (former CSMs, sales, partner managers, etc.)
# are excluded at load time. Update when the team changes.
CSM_LIST: list[str] = [
    "Aastha Jindal",
    "Bhargav Prasad",
    "Janhvi Gupta",
    "Joe Huisman",
]


def _to_numeric(series: pd.Series) -> pd.Series:
    cleaned = series.astype(str).str.replace(r"[\$,]", "", regex=True).str.strip()
    return pd.to_numeric(cleaned, errors="coerce").fillna(0.0)


def _fetch_and_clean() -> pd.DataFrame:
    # requests ships with certifi, avoiding the macOS python.org SSL trust issue
    # that surfaces if we hand the https URL straight to pd.read_csv.
    resp = requests.get(SHEET_CSV_URL, timeout=30, allow_redirects=True)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    df = df.rename(columns=COLUMN_MAP)
    for col in NUMERIC_FIELDS:
        if col in df.columns:
            df[col] = _to_numeric(df[col])
    # Drop SF report grand-total / subtotal rows — they come through with NaN
    # identifiers but pre-aggregated values that double-count if summed again.
    df = df.dropna(subset=[CSM_COL, "Deal Name"]).reset_index(drop=True)
    # Note: we deliberately do NOT filter rows to CSM_LIST here — to match the
    # source SF dashboard's "All" filter semantics, scorecard aggregations
    # include opps owned by non-CSMs. Per-CSM charts filter to CSM_LIST in app.py.
    return df


@st.cache_data(ttl=600, show_spinner="Fetching Salesforce report from Google Sheets…")
def load_report1() -> pd.DataFrame:
    return _fetch_and_clean()
