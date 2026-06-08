# CSM Book of Business — Business Logic

**Audience:** CSMs, RevOps, anyone reading the dashboard or auditing the LLM digest.
**Companion docs:** [DASHBOARD_SPEC.md](DASHBOARD_SPEC.md) (technical metric catalog), [BRD.md](BRD.md) (memory layers + roadmap).

This doc answers three questions:

1. What **fields** exist, what do they mean, and where do they come from?
2. Which fields **matter most**?
3. In what **order** is the data read, normalized, grouped, and turned into the tiles you see?

---

## 1. Field catalog

### 1.1 Identifiers and dimensions

These are filter / grouping / drill-down keys. None of them carry a dollar amount.

| Sheet column | Significance | Used as |
|---|---|---|
| `Deal Name` | Opportunity name as it appears in SF. | Drill-down label |
| `Account Name` | Customer name. | Drill-down label, grouping when sliced by account |
| `Opportunity Owner` | The CSM owning the renewal/expansion. **This is our canonical "CSM" for the dashboard** — even though a separate `CSM` column exists, leadership confirmed Opp Owner is the source of truth. | Primary filter; chart x-axis |
| `CSM` | Often equals Opportunity Owner but not guaranteed. **Ignored for v1.** | — |
| `Type` | `Renewal` or `Expansion`. Defines whether the opp shows up in GRR (Renewal only) or NRR (both) bases. | Filter for sub-views (none in v1) |
| `Forecast Category` | SF's commit-confidence bucket: `Closed`, `Commit`, `Best Case`, `Pipeline`, `Omitted`. | Drives `To_include_in_GRR_v2` / `To_include_in_NRR` upstream in SF |
| `Stage` | SF stage of the opp (e.g., `Negotiation`, `Closed Won`, `Closed Lost`). | Audit, drill-down |
| `Renewal Status` | Sub-status for renewal opps. | Drill-down |
| `Renewal Type` | E.g., auto-renewal vs negotiated. | Drill-down |
| `Close Date (2)` | SF Close Date. The "(2)" is because the report has a second projected-date column too — minor SF artifact. | Used to bucket into quarters |
| `Opp_closed_date_quarter` | Pre-computed quarter string like `Q1 CY2026`. **Use this for the Quarter filter** — saves us deriving from Close Date. | Quarter filter, chart series |
| `Opportunity_contract_start_quarter` | Pre-computed quarter for contract-start. | Not used in v1 |

### 1.2 Raw $ inputs (the 15 numerics that feed metrics)

Every dollar that ends up in a tile flows through one of these. Each is an SF custom field calculated server-side in Salesforce; we don't try to re-derive them.

| Sheet header → Canonical name | Meaning | Why it matters |
|---|---|---|
| `Projected NRR (numerator)` → `To_include_in_NRR` | Forecasted dollars eligible for NRR — what we *expect* to retain + expand. | Numerator of `NRR%` and feeds both NRR gap formulas |
| `Projected GRR (numerator)` → `To_include_in_GRR_v2` | Forecasted dollars eligible for GRR — what we *expect* to retain on the renewal book. | Numerator of `GRR%` and feeds both GRR gap formulas |
| `NRR_Base` | Prior-period ARR used as the base for NRR. Includes the renewal base + expansion seed. | Denominator of `NRR%`, `% Book in Risk`, `Expansion % of Renewal Base` |
| `Base_GRR` | Prior-period ARR used as the base for GRR — renewal book only. | Denominator of `GRR%` and *all four* gap formulas (yes, including the NRR gaps — see §1.4 note) |
| `NRR_actuals` | Actuals booked under NRR scope this period (closed-won renewals + expansion). | Numerator of NRR YTD Actuals %, also feeds `Renewal ARR Due` |
| `GRR_actuals` | Actuals booked under GRR scope this period (closed-won renewals only). | Numerator of GRR YTD Actuals % |
| `ARR_High_Risk_Renewal` | Dollars currently flagged as high risk of not renewing. | Risk tile, `% Book in Risk` |
| `ARR_Expected_Churn` | Dollars expected to churn. | Churn tile, `% Book in Risk` |
| `Expansion_contri` | Expansion contribution to NRR. | Feeds the expansion-share metric (deferred to Report 2) |
| `ARR_PriorCV_Closed_Renewal_only__c` → `ARR_PriorCV_Closed_Renewal_only_c` | Prior contract value of renewals already closed (won OR lost). | Subtracted from `Renewal ARR Due YTD` |
| `ARR_PriorCV_Expected_Churn__c` → `ARR_PriorCV_Expected_Churn_c` | Prior contract value of opps expected to churn. | Subtracted from `Renewal ARR Due YTD` |
| `ARR_PriorCV_High_Risk_Renewal__c` → `ARR_PriorCV_High_Risk_Renewal_c` | Prior contract value of opps flagged high risk. | Subtracted from `Renewal ARR Due YTD` |
| `ARR_PriorCV_churned__c` → `ARR_PriorCV_churned_c` | Prior contract value of opps that already churned. | Subtracted from `Renewal ARR Due YTD` |
| `Embedded_renewal_uplift_amt` | Built-in price uplift baked into the renewal terms. | Embedded Renewal Uplift % (deferred display) |
| `closed_won_ARR` | ARR of opportunities that are Closed Won. | Closed-Won Renewal tile |

### 1.3 Fields present in the Sheet but **not used** in v1

Kept because they're useful for future drill-down or context, but the dashboard ignores them.

`Multi-year deal?`, `expansion_test`, `Customer as of 2026-01-01`, `Amount`, `Prior Contract Value`, `Annual Contract Value (ACV)`, `Upgrade/Downgrade Amount`, `Created Date`, `Contract Start Date`, `Contract End Date`, `Fiscal Period`, `Account Segment`, `[TCV] Total Contract Value`, `Churn Risk Flag`, `Churn Risk Category`, `Churn Risk Sub-Category`, `Churn Risk Notes`, `YTD_NRR_actuals`, `NRR_Base_YTD`, `Base_GRR_YTD`, `YTD_GRR_actuals`, `Renewals_due_YTD`, `Renewals_closed_YTD`, `NRR_Base_Open_Opp`, `ARR_churned`, `ARR_Closed_Renewal_only`.

The four `*_YTD` numerics deserve a footnote: **we deliberately use the non-YTD versions** (`Base_GRR`, `NRR_actuals`, etc.) in every formula. The `_YTD` variants exist in the Sheet but are not what the source SF dashboard formulas reference.

### 1.4 Important asymmetry — intentional, do not "fix"

The NRR gap formulas (`% NRR Gap`, `NRR Gap`) divide / subtract from **`Base_GRR`**, not `NRR_Base`. The NRR% itself uses `NRR_Base`. The `% Book in Risk` denominator uses `NRR_Base`. This is the SF logic as written; the spec doc has it locked in.

---

## 2. What to focus on

If a CSM had to glance at the dashboard for 10 seconds, the order of importance:

1. **% GRR Gap** — are we tracking to the 95% retention target?
2. **NRR Gap ($)** — how many dollars short of 110% NRR are we?
3. **Renewal Remaining** — how much renewal book is still open and not yet at risk?
4. **At-risk ARR (High Risk + Expected Churn combined)** — what's the immediate save list?
5. **Closed-Won Renewal** — how much have we banked already this period?

If the CSM head had 10 seconds:

1. **GRR%** per CSM × quarter — who's underperforming?
2. **NRR%** per CSM × quarter — who's expanding the book?
3. **% Book in Risk** per CSM — where is the risk concentrated?

If the CEO had 10 seconds:

1. The executive-summary strip at the top — WoW deltas + 3-bullet LLM highlights.
2. Closed-Won Renewal $.

---

## 3. Execution / logic order

Every render of every tile goes through these steps. Useful when debugging "why doesn't this number match SF?"

### Step 1 — Fetch
- Pull `https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:csv&gid=0` (server-side, 10-min cache).

### Step 2 — Clean
- Parse CSV.
- **Drop subtotal rows:** any row where `Opportunity Owner` or `Deal Name` is empty. Salesforce report exports often include grand-total rows that double-count if summed.
- Coerce the 15 numeric columns to floats (strip `$` and `,`).
- Rename 6 columns to canonical names (see §1.2).

### Step 3 — Apply user filters
- `Opp_closed_date_quarter ∈ selected_quarters` (always applied).
- If user selected specific CSMs in the dropdown → `Opportunity Owner ∈ selected_csms`.
- If user selected the `All` sentinel → no owner filter.

### Step 4 — Two derived row sets
- **`filtered`** — used by scorecard tiles. Includes opps owned by non-CSMs when `All` is selected (matches SF).
- **`chart_df`** — `filtered` further narrowed to `Opportunity Owner ∈ CSM_LIST` (the 4 named CSMs). Charts always show only the 4 CSMs.

### Step 5 — Aggregate (for scorecard tiles)
- Sum each input column across all rows in `filtered`.
- Apply the formula. **Never compute a ratio per row and average** — sum-then-divide is the only correct order.

### Step 6 — Group (for CSM × Quarter charts)
- Group `chart_df` by `(Opportunity Owner, Opp_closed_date_quarter)`.
- For each (CSM, Quarter) cell, sum the input columns within that cell, then apply the formula.
- Plot.

### Step 7 — Format
- Percentages: 1 decimal, e.g., `4.1%`.
- Currency: `$1.2M` ≥ 1M; `$430K` ≥ 1K; else `$987`.

---

## 4. Worked example — how `% GRR Gap` ends up as `4.1%`

1. Pull Sheet → 151 raw rows → drop 4 subtotal rows → 147 rows after cleanup. *(Numbers will drift week to week.)*
2. User leaves filters at default (all quarters, `All` CSMs). `filtered` = 147 rows.
3. Sum `Base_GRR` across `filtered` → `$4,154,800`.
4. Sum `To_include_in_GRR_v2` across `filtered` → `$3,777,204`.
5. Apply formula: `(0.95 × 4,154,800 − 3,777,204) / 4,154,800` = `(3,947,060 − 3,777,204) / 4,154,800` = `169,856 / 4,154,800` = `0.0409`.
6. Format → `4.1%`.

The same logic runs for every other percentage tile — only the input columns change.

---

## 5. When numbers don't match

In order of likelihood:

1. **The Sheet was refreshed between your check and the dashboard fetch.** Live layer is on a 10-min cache; SF connector refreshes on its own schedule.
2. **You compared the wrong cut.** Scorecard tiles use `filtered` (includes non-CSM owners when `All`); charts use `chart_df` (CSMs only). Cross-checking a chart cell against a scorecard tile will not reconcile.
3. **Per-row ratio averaging.** If a colleague computed a CSM's GRR% in Sheets by averaging row-level ratios, that won't equal our sum-then-divide. Ours is the correct one.
4. **The four subtotal rows weren't dropped.** Common when reading the Sheet raw — they make `ARR_PriorCV_*` columns blow up by 4×.
5. **A column rename was missed.** The 6 renames in §1.2 must happen before any metric is computed.
