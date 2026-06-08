# CSM Book of Business Dashboard — Spec

Replicates the Salesforce dashboard "CSM Book of Business - Retention and Expansion" as a Streamlit app that reads from Google Sheets (Salesforce reports linked via the Salesforce Connector).

## Stack
- Streamlit + Pandas
- Google Sheets API (gspread) — Sheets populated by Salesforce → Sheets Connector
- Fixed targets: **95% GRR**, **110% NRR**
- Local-only hosting for now (will share to CSMs once formulas are validated)

## Data sources

### Report 1 — Consolidated Renewal + Expansion *(this doc)*
In Salesforce this is split across three sibling reports — the base FY26 report, a "Misc" variant, and a "GRR/NRR" variant — that share the same row universe (Opportunities of `Type ∈ {Renewal, Expansion}`) but expose different report-level summary formulas because of SF's per-report metric limit.

For the dashboard we consolidate into **one master SF report → one Google Sheet** that exposes every raw field referenced by the metric catalog below. The 13 derived metrics are recomputed in Python — we do **not** read them from the Sheet.

### Report 2 — Expansion-only
Covered in a follow-up section once Report 1 is locked.

---

## Metric catalog — Report 1

All formulas are SF report-level summary formulas (`:SUM` aggregation) evaluated within the active grouping (e.g., CSM owner × Close Date quarter).

> **Replication note:** `:SUM` means *sum first, divide after*. In Python: group rows by the dashboard's active dimensions, sum each input column, then apply the formula. Never compute the ratio per row and average — that produces the wrong number.

| # | Metric | Formula | Inputs (API names) |
|---|---|---|---|
| 1 | **NRR%** (`NRR formula`) | `SUM(To_include_in_NRR) / SUM(NRR_Base)` | `To_include_in_NRR__c`, `NRR_Base__c` |
| 2 | **Expansion % of Renewal Base** | `SUM(Expansion_contri) / SUM(NRR_Base)` | `Expansion_contri__c`, `NRR_Base__c` |
| 3 | **% Book in Risk** | `(SUM(ARR_High_Risk_Renewal) + SUM(ARR_Expected_Churn)) / SUM(NRR_Base)` | `ARR_High_Risk_Renewal__c`, `ARR_Expected_Churn__c`, `NRR_Base__c` |
| 4 | **Renewal ARR Due** | `SUM(Base_GRR) − SUM(NRR_actuals)` | `Base_GRR__c`, `NRR_actuals__c` |
| 5 | **GRR YTD Actuals %** (`GRR_YTD_actuals_v2`) | `SUM(GRR_actuals) / SUM(Base_GRR)` | `GRR_actuals__c`, `Base_GRR__c` |
| 6 | **GRR%** (`GRR formula`) | `SUM(To_include_in_GRR_v2) / SUM(Base_GRR)` | `To_include_in_GRR_v2__c`, `Base_GRR__c` |
| 7 | **NRR YTD Actuals %** (`NRR_YTD_actuals_v2`) | `SUM(NRR_actuals) / SUM(NRR_Base)` | `NRR_actuals__c`, `NRR_Base__c` |
| 8 | **Renewal ARR Due YTD** | `SUM(Base_GRR) − SUM(ARR_PriorCV_Closed_Renewal_only_c) − SUM(ARR_PriorCV_Expected_Churn_c) − SUM(ARR_PriorCV_High_Risk_Renewal_c) − SUM(ARR_PriorCV_churned_c)` | `Base_GRR__c`, `ARR_PriorCV_Closed_Renewal_only_c__c`, `ARR_PriorCV_Expected_Churn_c__c`, `ARR_PriorCV_High_Risk_Renewal_c__c`, `ARR_PriorCV_churned_c__c` |
| 9 | **% GRR Gap** | `(0.95 × SUM(Base_GRR) − SUM(To_include_in_GRR_v2)) / SUM(Base_GRR)` | `Base_GRR__c`, `To_include_in_GRR_v2__c` |
| 10 | **Embedded Renewal Uplift %** | `SUM(Embedded_renewal_uplift_amt) / SUM(Base_GRR)` | `Embedded_renewal_uplift_amt__c`, `Base_GRR__c` |
| 11 | **% NRR Gap** | `(1.10 × SUM(Base_GRR) − SUM(To_include_in_NRR)) / SUM(Base_GRR)` | `Base_GRR__c`, `To_include_in_NRR__c` |
| 12 | **GRR Gap ($)** | `0.95 × SUM(Base_GRR) − SUM(To_include_in_GRR_v2)` | `Base_GRR__c`, `To_include_in_GRR_v2__c` |
| 13 | **NRR Gap ($)** | `1.10 × SUM(Base_GRR) − SUM(To_include_in_NRR)` | `Base_GRR__c`, `To_include_in_NRR__c` |

---

## Required input fields — Report 1

These **14 unique raw fields** must exist as columns in the consolidated Sheet. The "Sheet column" values below are the **actual headers** in the Google Sheet (confirmed). On load, the dashboard renames Sheet columns → canonical names (the third column) for use in the formula code.

| # | Salesforce API name | Sheet column header | Canonical name (used in formulas above) | Feeds metrics |
|---|---|---|---|---|
| 1 | `Opportunity.To_include_in_NRR__c` | `Projected NRR (numerator)` | `To_include_in_NRR` | 1, 11, 13 |
| 2 | `Opportunity.NRR_Base__c` | `NRR_Base` | `NRR_Base` | 1, 2, 3, 7 |
| 3 | `Opportunity.Expansion_contri__c` | `Expansion_contri` | `Expansion_contri` | 2 |
| 4 | `Opportunity.ARR_High_Risk_Renewal__c` | `ARR_High_Risk_Renewal` | `ARR_High_Risk_Renewal` | 3 |
| 5 | `Opportunity.ARR_Expected_Churn__c` | `ARR_Expected_Churn` | `ARR_Expected_Churn` | 3 |
| 6 | `Opportunity.Base_GRR__c` | `Base_GRR` | `Base_GRR` | 4, 5, 6, 8, 9, 10, 11, 12, 13 |
| 7 | `Opportunity.NRR_actuals__c` | `NRR_actuals` | `NRR_actuals` | 4, 7 |
| 8 | `Opportunity.GRR_actuals__c` | `GRR_actuals` | `GRR_actuals` | 5 |
| 9 | `Opportunity.To_include_in_GRR_v2__c` | `Projected GRR (numerator)` | `To_include_in_GRR_v2` | 6, 9, 12 |
| 10 | `Opportunity.ARR_PriorCV_Closed_Renewal_only_c__c` | `ARR_PriorCV_Closed_Renewal_only__c` | `ARR_PriorCV_Closed_Renewal_only_c` | 8 |
| 11 | `Opportunity.ARR_PriorCV_Expected_Churn_c__c` | `ARR_PriorCV_Expected_Churn__c` | `ARR_PriorCV_Expected_Churn_c` | 8 |
| 12 | `Opportunity.ARR_PriorCV_High_Risk_Renewal_c__c` | `ARR_PriorCV_High_Risk_Renewal__c` | `ARR_PriorCV_High_Risk_Renewal_c` | 8 |
| 13 | `Opportunity.ARR_PriorCV_churned_c__c` | `ARR_PriorCV_churned__c` | `ARR_PriorCV_churned_c` | 8 |
| 14 | `Opportunity.Embedded_renewal_uplift_amt__c` | `Embedded_renewal_uplift_amt` | `Embedded_renewal_uplift_amt` | 10 |
| 15 | `Opportunity.closed_won_ARR__c` | `closed_won_ARR` | `closed_won_ARR` | Direct sum → Widget A2-3 |

### Dimension / filter fields also needed
Not used inside formulas but required for filtering, grouping, and drill-down. Confirmed against the live Sheet:

| Purpose | Sheet column |
|---|---|
| Display name | `Deal Name` |
| Account | `Account Name` |
| CSM filter | `CSM` *(or `Opportunity Owner` — see open question 4)* |
| Quarter filter | `Close Date (2)` *(or `Opp_closed_date_quarter` for pre-computed quarter)* |
| Type filter | `Type` |
| Stage | `Stage` |
| Forecast Category | `Forecast Category` |
| Headline amount | `Amount` |
| Drill-down identifier | **Not present in Sheet** — see open question 5 |

### Full Sheet schema (Report 1, gid=0)

153 rows total (152 data rows + header). Captured 2026-05-26.

```
CSM, Opportunity Owner, Deal Name, Account Name, Multi-year deal?, Type,
expansion_test, Forecast Category, Renewal Type, Renewal Status, Stage,
Renewals_due_YTD, Renewals_closed_YTD, Customer as of 2026-01-01, Amount,
Projected GRR (numerator), Projected NRR (numerator), Close Date (2),
YTD_NRR_actuals, NRR_actuals, NRR_Base_YTD, Base_GRR_YTD, YTD_GRR_actuals,
GRR_actuals, NRR_Base, Base_GRR, Prior Contract Value,
Annual Contract Value (ACV), Upgrade/Downgrade Amount, Created Date,
Contract Start Date, Contract End Date, Fiscal Period, Account Segment,
[TCV] Total Contract Value, Churn Risk Flag, Churn Risk Category,
Churn Risk Sub-Category, Churn Risk Notes, Opportunity_contract_start_quarter,
Opp_closed_date_quarter, ARR_Expected_Churn, ARR_High_Risk_Renewal,
NRR_Base_Open_Opp, ARR_churned, ARR_Closed_Renewal_only,
ARR_PriorCV_churned__c, ARR_PriorCV_Closed_Renewal_only__c,
ARR_PriorCV_Expected_Churn__c, ARR_PriorCV_High_Risk_Renewal__c,
closed_won_ARR, Embedded_renewal_uplift_amt, Expansion_contri
```

---

## Resolved decisions — Report 1
- **Sheet column headers**: locked via the table above.
- **`_c__c` suffix** on the 4 `ARR_PriorCV_*` fields: accepted as-is (no fix needed).
- **`Base_GRR` vs `NRR_Base` asymmetry** in NRR Gap / %NRR Gap formulas: intentional, leave as written.
- **`%Book in Risk` denominator**: `NRR_Base` is intentional.
- **CSM owner source**: `Opportunity.Owner` (the Opp owner *is* the CSM).

## Resolved decisions (continued)
- **YTD vs non-YTD field selection in Actuals formulas.** Use the non-YTD columns (`Base_GRR`, `NRR_Base`, `NRR_actuals`, `GRR_actuals`) as written — do NOT switch to the `*_YTD` variants. Applies to Metrics 5, 7, 8 (`Renewal ARR Due YTD`) and downstream tiles.
- **`CSM` vs `Opportunity Owner`.** Use `Opportunity Owner` for the CSM dimension.
- **Drill-down identifier.** Not needed for now — no `Opportunity ID` required in the Sheet.
- **CSM list scope.** Active CSM team = `Aastha Jindal`, `Bhargav Prasad`, `Janhvi Gupta`, `Joe Huisman`. Per-CSM charts limit the x-axis to this list; aggregate scorecard tiles match the SF "All" semantics by including every owner (not narrowed to the 4 CSMs).

## Open questions — Report 1 (non-blocking; defer)
1. **Closed-quarter behavior.** When the user filters to a quarter that has already ended, should the "Projected" tiles still render against current data (≈ Actuals at that point) or be replaced by the YTD-Actuals variants?
2. **High Risk vs Expected Churn overlap.** Can one Opp count in both `ARR_High_Risk_Renewal` and `ARR_Expected_Churn`? Affects whether `%Book in Risk` can double-count.

---

---

## Widget catalog

Each tile / chart on the dashboard maps to one metric or one raw-field aggregation, evaluated at a specific cut and rendered in a specific format.

- **CSM × Quarter** cut = grouped chart (bar chart with CSM owner on x-axis, quarter as color/series — matches the current SF layout).
- **Aggregate** cut = single scorecard tile that evaluates the formula across whatever filter is active (selected quarter(s) and CSM(s)).

### Currency formatting rule (applies to every `$` tile)
- `≥ $1M` → `$1.2M`
- `≥ $1K` and `< $1M` → `$430K`
- `< $1K` → `$987`

### Section A1 — Projected & Gaps (top half of dashboard)

| # | Widget label | Source | Cut | Format |
|---|---|---|---|---|
| A1-1 | Projected GRR% | Metric 6 — GRR% | CSM × Quarter | % |
| A1-2 | %GRR Gap | Metric 9 — % GRR Gap | Aggregate | % |
| A1-3 | Target GRR Gap | Metric 12 — GRR Gap ($) | Aggregate | Currency M/K |
| A1-4 | %Book in Risk | Metric 3 — % Book in Risk | CSM × Quarter | % |
| A1-5 | FY26 ARR High Risk Renewal | `SUM(ARR_High_Risk_Renewal)` (raw field 4) | Aggregate | Currency M/K |
| A1-6 | FY26 ARR Expected Churn | `SUM(ARR_Expected_Churn)` (raw field 5) | Aggregate | Currency M/K |
| A1-7 | Projected NRR% | Metric 1 — NRR% | CSM × Quarter | % |
| A1-8 | %NRR Gap | Metric 11 — % NRR Gap | Aggregate | % |
| A1-9 | NRR Gap | Metric 13 — NRR Gap ($) | Aggregate | Currency M/K |

### Section A2 — NRR & GRR Actuals (bottom half of dashboard)

| # | Widget label | Source | Cut | Format |
|---|---|---|---|---|
| A2-1 | GRR% Actuals | Metric 5 — GRR YTD Actuals % | CSM × Quarter | % |
| A2-2 | Renewal Remaining | Metric 8 — Renewal ARR Due YTD | Aggregate | Currency M/K |
| A2-3 | Closed-Won Renewal | `SUM(Closed_Won_ARR)` (raw field 15) | Aggregate | Currency M/K |
| A2-4 | NRR% Actuals | Metric 7 — NRR YTD Actuals % | CSM × Quarter | % |

### Sections not yet mapped
The Salesforce dashboard also has these tiles (we'll cover them when we get to Report 2):
- Expansion Opps 2026 — Q1-Q4 donut
- Renewal % Upgrade
- Standalone Expansion %

---

## Not yet covered
- Report 2 (Expansion-only) — metric catalog + the 3 unmapped tiles above
- Drill-down UX (which tile → which opp list)
- Data refresh cadence
