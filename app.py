"""CSM Book of Business — Retention and Expansion dashboard.

Replicates the Salesforce dashboard of the same name. Reads the master report
from a linked Google Sheet (see DASHBOARD_SPEC.md for sources & formulas).
"""

from __future__ import annotations

import math

import pandas as pd
import plotly.express as px
import streamlit as st

from data_loader import CSM_COL, CSM_LIST, QUARTER_COL, load_report1
from metrics import (
    GRR_TARGET,
    NRR_TARGET,
    by_csm_quarter,
    grr_gap_dollars,
    grr_pct,
    grr_ytd_actuals_pct,
    nrr_gap_dollars,
    nrr_pct,
    nrr_ytd_actuals_pct,
    pct_book_in_risk,
    pct_grr_gap,
    pct_nrr_gap,
    renewal_arr_due_ytd,
    sum_arr_expected_churn,
    sum_arr_high_risk_renewal,
    sum_closed_won_arr,
)


# ---- formatting helpers ------------------------------------------------------

def _is_nan(v) -> bool:
    return v is None or (isinstance(v, float) and math.isnan(v))


def fmt_currency(value: float) -> str:
    if _is_nan(value):
        return "—"
    abs_v = abs(value)
    sign = "-" if value < 0 else ""
    if abs_v >= 1_000_000:
        return f"{sign}${abs_v / 1_000_000:.1f}M"
    if abs_v >= 1_000:
        return f"{sign}${abs_v / 1_000:.0f}K"
    return f"{sign}${abs_v:,.0f}"


def fmt_pct(value: float) -> str:
    if _is_nan(value):
        return "—"
    return f"{value * 100:.1f}%"


# Plotly quarter palette (matches the SF dashboard's blue→purple progression).
QUARTER_COLORS = {
    "Q1 CY2026": "#1f77b4",
    "Q2 CY2026": "#56b4e9",
    "Q3 CY2026": "#7b3fbb",
    "Q4 CY2026": "#c094df",
}


def stat_card(label: str, value: str, caption: str | None = None,
              tone: str = "neutral") -> None:
    """Compact card replacement for st.metric — bigger value, subtle border."""
    tone_color = {
        "good": "#059669",
        "bad": "#dc2626",
        "neutral": "#111827",
    }[tone]
    sub = f'<div class="card-cap">{caption}</div>' if caption else ""
    st.markdown(
        f"""
        <div class="stat-card">
          <div class="card-label">{label}</div>
          <div class="card-value" style="color:{tone_color}">{value}</div>
          {sub}
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_csm_quarter_chart(
    df: pd.DataFrame,
    metric_fn,
    title: str,
    target: float | None = None,
) -> None:
    cells = by_csm_quarter(df, metric_fn).dropna(subset=["value"])
    if cells.empty:
        st.info(f"No data for {title}.")
        return
    cells = cells.sort_values(["CSM", "Quarter"])
    fig = px.bar(
        cells,
        x="CSM",
        y="value",
        color="Quarter",
        barmode="group",
        color_discrete_map=QUARTER_COLORS,
        text=cells["value"].apply(fmt_pct),
        title=title,
        height=300,
        template="plotly_white",
    )
    fig.update_yaxes(tickformat=".0%", title=None, gridcolor="#eef0f3")
    fig.update_xaxes(title=None)
    fig.update_traces(textposition="outside", cliponaxis=False, textfont_size=11)
    if target is not None:
        fig.add_hline(
            y=target,
            line_dash="dot",
            line_color="#9ca3af",
            annotation_text=f"{int(target * 100)}% target",
            annotation_position="top right",
            annotation_font_size=10,
            annotation_font_color="#6b7280",
        )
    fig.update_layout(
        margin=dict(l=8, r=8, t=44, b=8),
        legend=dict(
            orientation="h", yanchor="bottom", y=-0.2, xanchor="left", x=0,
            title_text="",
        ),
        title=dict(font=dict(size=14, color="#111827"), x=0, xanchor="left"),
        plot_bgcolor="white",
        paper_bgcolor="white",
    )
    st.plotly_chart(
        fig, use_container_width=True,
        config={"displayModeBar": False, "staticPlot": False},
    )


# ---- page setup --------------------------------------------------------------

st.set_page_config(
    page_title="CSM Book of Business",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Custom CSS: tighten padding, style cards, hide Streamlit chrome.
st.markdown(
    """
    <style>
      /* Tighten page padding */
      .block-container { padding-top: 1.5rem; padding-bottom: 2rem; max-width: 1500px; }
      /* Hide Streamlit's footer + the 'Made with Streamlit' bit */
      footer { visibility: hidden; }
      #MainMenu { visibility: hidden; }
      header[data-testid="stHeader"] { background: transparent; }

      /* Bordered stat card */
      .stat-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 0.85rem 1rem;
        margin-bottom: 0.6rem;
        box-shadow: 0 1px 2px rgba(16,24,40,0.04);
      }
      .stat-card .card-label {
        color: #6b7280;
        font-size: 0.78rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 0.2rem;
      }
      .stat-card .card-value {
        font-size: 1.85rem;
        font-weight: 650;
        line-height: 1.1;
      }
      .stat-card .card-cap {
        color: #9ca3af;
        font-size: 0.75rem;
        margin-top: 0.15rem;
      }

      /* Section header */
      .section-h {
        font-size: 1.05rem;
        font-weight: 600;
        color: #1f2937;
        margin: 0.4rem 0 0.6rem;
        padding-bottom: 0.35rem;
        border-bottom: 2px solid #e5e7eb;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("CSM Book of Business")
st.caption(
    f"Retention and Expansion · GRR target {int(GRR_TARGET * 100)}% · "
    f"NRR target {int(NRR_TARGET * 100)}%"
)

df = load_report1()

# ---- filter controls ---------------------------------------------------------

all_quarters = sorted([q for q in df[QUARTER_COL].dropna().unique()])
ALL_SENTINEL = "All"
csm_options = [ALL_SENTINEL] + CSM_LIST

f1, f2 = st.columns(2)
sel_quarters = f1.multiselect(
    "Quarter (Close Date)", all_quarters, default=all_quarters
)
sel_csms = f2.multiselect("CSM Owner", csm_options, default=[ALL_SENTINEL])

df_q = df[df[QUARTER_COL].isin(sel_quarters)]
csms_picked = [c for c in sel_csms if c != ALL_SENTINEL]
if not sel_csms or ALL_SENTINEL in sel_csms:
    filtered = df_q
else:
    filtered = df_q[df_q[CSM_COL].isin(csms_picked)]

chart_df = filtered[filtered[CSM_COL].isin(CSM_LIST)]

if filtered.empty:
    st.warning("No rows match the current filters.")
    st.stop()


# ---- Section A1: Projected & Gaps -------------------------------------------

st.markdown('<div class="section-h">Projected & Gaps</div>', unsafe_allow_html=True)

# Row 1: GRR chart | GRR Gap cards | Book in Risk chart | Risk cards
r1c1, r1c2, r1c3, r1c4 = st.columns([3, 1.3, 3, 1.3])

with r1c1:
    render_csm_quarter_chart(chart_df, grr_pct, "Projected GRR%", target=GRR_TARGET)

with r1c2:
    pct = pct_grr_gap(filtered)
    stat_card(
        "% GRR Gap", fmt_pct(pct),
        caption=f"vs {int(GRR_TARGET * 100)}% target",
        tone="bad" if (pct or 0) > 0 else "good",
    )
    gap_dollars = grr_gap_dollars(filtered)
    stat_card(
        "Target GRR Gap", fmt_currency(gap_dollars),
        caption=f"to reach {int(GRR_TARGET * 100)}%",
        tone="bad" if gap_dollars > 0 else "good",
    )

with r1c3:
    render_csm_quarter_chart(chart_df, pct_book_in_risk, "% Book in Risk")

with r1c4:
    stat_card(
        "FY26 ARR High Risk Renewal",
        fmt_currency(sum_arr_high_risk_renewal(filtered)),
        tone="bad",
    )
    stat_card(
        "FY26 ARR Expected Churn",
        fmt_currency(sum_arr_expected_churn(filtered)),
        tone="bad",
    )

# Row 2: NRR chart | NRR Gap cards | (Report 2 placeholders)
r2c1, r2c2, r2c3, r2c4 = st.columns([3, 1.3, 3, 1.3])

with r2c1:
    render_csm_quarter_chart(chart_df, nrr_pct, "Projected NRR%", target=NRR_TARGET)

with r2c2:
    pct = pct_nrr_gap(filtered)
    stat_card(
        "% NRR Gap", fmt_pct(pct),
        caption=f"vs {int(NRR_TARGET * 100)}% target",
        tone="bad" if (pct or 0) > 0 else "good",
    )
    nrr_dollars = nrr_gap_dollars(filtered)
    stat_card(
        "NRR Gap", fmt_currency(nrr_dollars),
        caption=f"to reach {int(NRR_TARGET * 100)}%",
        tone="bad" if nrr_dollars > 0 else "good",
    )

with r2c3:
    st.empty()  # Expansion Opps donut → Report 2

with r2c4:
    st.empty()  # Standalone Expansion % / Renewal % Upgrade → Report 2


# ---- Section A2: NRR & GRR Actuals ------------------------------------------

st.markdown('<div class="section-h">NRR &amp; GRR Actuals</div>', unsafe_allow_html=True)

a2c1, a2c2, a2c3 = st.columns([3, 1.8, 3])

with a2c1:
    render_csm_quarter_chart(
        chart_df, grr_ytd_actuals_pct, "GRR% Actuals", target=GRR_TARGET
    )

with a2c2:
    stat_card(
        "Renewal Remaining",
        fmt_currency(renewal_arr_due_ytd(filtered)),
        caption="Excludes ARR in Risk · prior contract value",
    )
    stat_card(
        "Closed-Won Renewal",
        fmt_currency(sum_closed_won_arr(filtered)),
        tone="good",
    )

with a2c3:
    render_csm_quarter_chart(
        chart_df, nrr_ytd_actuals_pct, "NRR% Actuals", target=NRR_TARGET
    )
