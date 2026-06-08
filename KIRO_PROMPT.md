# CSM Book of Business — Frontend Build Brief

> Build a single-page web dashboard that replicates our internal Salesforce
> dashboard "CSM Book of Business — Retention and Expansion." The data lives
> in a public Google Sheet (link below). All metric formulas and the data
> schema are fully specified in this brief; you have everything you need to
> build end-to-end. Ask before guessing only on items called out in the
> "Confirm before coding" section at the bottom.

---

## 1. Product

**Audience.** Four CSMs and CS leadership at Zuddl.
**Problem.** The current Salesforce native dashboard is slow to refresh, can't show ops the underlying deals, and the layout is constrained by Salesforce widgets.
**Goal.** A polished web dashboard that (a) re-derives the SF dashboard's KPIs from raw report rows, (b) supports multi-select filtering by quarter and CSM, (c) has a clean modern UI that doesn't look like an SF iframe.

---

## 2. Tech stack (recommended)

- **Framework:** Next.js 14 (App Router) + TypeScript, strict mode.
- **Styling:** Tailwind CSS + shadcn/ui (for `Card`, `Select`, `Badge`, `Separator`, etc.).
- **Charts:** Recharts (grouped bar charts).
- **Data fetch:** Server-side via Next.js `fetch()` with `next: { revalidate: 600 }`. No DB, no backend service.
- **No auth** for v1 — internal use, run on localhost or a private Vercel preview.
- **Package manager:** pnpm preferred, npm fine.

Justification: server-rendered, easy to host on Vercel later, the data source is small (~150 rows), filtering can run entirely client-side after the initial server fetch.

---

## 3. Data source

**Google Sheet (publicly readable, CSV export endpoint):**

```
https://docs.google.com/spreadsheets/d/1_mnKGada5DP-0uAWJ_Av9RJH1ed1bseQozYVvDEA72o/gviz/tq?tqx=out:csv&gid=0
```

Use the `gviz` endpoint, **not** `/export?format=csv` — the latter 307-redirects to a signed `doc-04-2o-sheets.googleusercontent.com` URL that rejects plain unauthenticated follow-ups.

Refresh cadence: every 10 minutes (`revalidate: 600`). No manual refresh button needed for v1, but a small "Updated X mins ago" caption in the header is nice.

### Sheet schema (53 columns, header row)

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

### Data normalization pipeline (server-side, after CSV parse)

1. **Drop SF subtotal rows.** Salesforce CSV exports inject grand-total rows with `NaN` in identifier columns and pre-aggregated numerics that double-count. Drop any row where `Opportunity Owner` OR `Deal Name` is empty/null.
2. **Coerce numerics** for all 15 input fields below. Strip `$` and `,`, parse as float, default to `0` on failure.
3. **Rename to canonical names** (only the renames below; pass everything else through unchanged):

| Sheet column header | Canonical name |
|---|---|
| `Projected NRR (numerator)` | `To_include_in_NRR` |
| `Projected GRR (numerator)` | `To_include_in_GRR_v2` |
| `ARR_PriorCV_Closed_Renewal_only__c` | `ARR_PriorCV_Closed_Renewal_only_c` |
| `ARR_PriorCV_Expected_Churn__c` | `ARR_PriorCV_Expected_Churn_c` |
| `ARR_PriorCV_High_Risk_Renewal__c` | `ARR_PriorCV_High_Risk_Renewal_c` |
| `ARR_PriorCV_churned__c` | `ARR_PriorCV_churned_c` |

Other input columns (`NRR_Base`, `Base_GRR`, `NRR_actuals`, `GRR_actuals`, `ARR_High_Risk_Renewal`, `ARR_Expected_Churn`, `Expansion_contri`, `closed_won_ARR`, `Embedded_renewal_uplift_amt`) already use the canonical name in the Sheet.

---

## 4. Domain constants

```typescript
export const CSM_LIST = [
  "Aastha Jindal",
  "Bhargav Prasad",
  "Janhvi Gupta",
  "Joe Huisman",
] as const;

export const GRR_TARGET = 0.95;
export const NRR_TARGET = 1.10;

export const CSM_COL = "Opportunity Owner";
export const QUARTER_COL = "Opp_closed_date_quarter";
```

Quarters in the data are strings like `"Q1 CY2026"`, `"Q2 CY2026"`, `"Q3 CY2026"`, `"Q4 CY2026"`. Sort lexicographically — no special handling required.

---

## 5. Input fields (15 raw numerics required from the Sheet)

After renaming, every metric reads from these 15 numeric columns. Sum-then-divide semantics: **sum each input across the currently-grouped rows, then apply the formula.** Never compute per-row ratios and average — that yields the wrong number for percentages.

```
To_include_in_NRR
To_include_in_GRR_v2
NRR_Base
Base_GRR
NRR_actuals
GRR_actuals
ARR_High_Risk_Renewal
ARR_Expected_Churn
Expansion_contri
ARR_PriorCV_Closed_Renewal_only_c
ARR_PriorCV_Expected_Churn_c
ARR_PriorCV_High_Risk_Renewal_c
ARR_PriorCV_churned_c
Embedded_renewal_uplift_amt
closed_won_ARR
```

---

## 6. Derived metrics (13 formulas)

All take an array of row objects and return a number. Use a `safeDiv(num, den)` helper that returns `NaN` when `den === 0`.

```typescript
type Row = Record<string, number | string | null>;

const sum = (rows: Row[], col: string) =>
  rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0);

const safeDiv = (a: number, b: number) => (b === 0 ? NaN : a / b);

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
    sum(rows, "NRR_Base")
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

// 8. Renewal ARR Due YTD (used by "Renewal Remaining" tile)
export const renewalArrDueYtd = (rows: Row[]) =>
  sum(rows, "Base_GRR")
    - sum(rows, "ARR_PriorCV_Closed_Renewal_only_c")
    - sum(rows, "ARR_PriorCV_Expected_Churn_c")
    - sum(rows, "ARR_PriorCV_High_Risk_Renewal_c")
    - sum(rows, "ARR_PriorCV_churned_c");

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
```

Note the asymmetry — **intentional**, do not "fix" it:
- `NRR%` (metric 1) divides by `NRR_Base`.
- `%NRR Gap` and `NRR Gap` (metrics 11, 13) divide / subtract from `Base_GRR`.
- `% Book in Risk` (metric 3) divides by `NRR_Base`.
- `Renewal ARR Due YTD` (metric 8) uses `Base_GRR`, not `Base_GRR_YTD`. The Sheet has both — pick the non-YTD one as written.

---

## 7. Widget catalog (13 widgets)

Two cuts:
- **CSM × Quarter** → grouped Recharts bar chart (CSM on x-axis, one bar per quarter, color-coded). Only the 4 CSMs from `CSM_LIST` show up on the x-axis, regardless of filter.
- **Aggregate** → scorecard / KPI card.

Currency formatting:
- ≥ $1M → `$1.2M`
- ≥ $1K → `$430K`
- < $1K → `$987`

Percent: `4.1%` (one decimal).

### Section A — Projected & Gaps

| # | Widget | Source | Cut | Format |
|---|---|---|---|---|
| A-1 | Projected GRR% | `grrPct` | CSM × Quarter | % bars + 95% dotted target line |
| A-2 | % GRR Gap | `pctGrrGap` | Aggregate | % (red if positive, green if zero/negative) |
| A-3 | Target GRR Gap | `grrGapDollars` | Aggregate | Currency M/K (red if positive) |
| A-4 | % Book in Risk | `pctBookInRisk` | CSM × Quarter | % bars, no target line |
| A-5 | FY26 ARR High Risk Renewal | `sum(rows, "ARR_High_Risk_Renewal")` | Aggregate | Currency M/K (red) |
| A-6 | FY26 ARR Expected Churn | `sum(rows, "ARR_Expected_Churn")` | Aggregate | Currency M/K (red) |
| A-7 | Projected NRR% | `nrrPct` | CSM × Quarter | % bars + 110% dotted target line |
| A-8 | % NRR Gap | `pctNrrGap` | Aggregate | % (red if positive) |
| A-9 | NRR Gap | `nrrGapDollars` | Aggregate | Currency M/K (red if positive) |

### Section B — NRR & GRR Actuals

| # | Widget | Source | Cut | Format |
|---|---|---|---|---|
| B-1 | GRR% Actuals | `grrYtdActualsPct` | CSM × Quarter | % bars + 95% target line |
| B-2 | Renewal Remaining | `renewalArrDueYtd` | Aggregate | Currency M/K — subtitle "Excludes ARR in Risk · prior contract value" |
| B-3 | Closed-Won Renewal | `sum(rows, "closed_won_ARR")` | Aggregate | Currency M/K (green) |
| B-4 | NRR% Actuals | `nrrYtdActualsPct` | CSM × Quarter | % bars + 110% target line |

### Reserved (do NOT build in v1 — leave grid cells empty or "Coming soon")

- Expansion Opps 2026 — Q1-Q4 donut
- Renewal % Upgrade
- Standalone Expansion %

---

## 8. Filter UX

Two filter controls at the top of the page, both multi-select.

### Quarter (Close Date)
- Options: distinct values of `Opp_closed_date_quarter` from the data, sorted ascending (`Q1 CY2026` first).
- Default: all selected.
- Filter applies to **both** scorecard tiles and CSM × Quarter charts.

### CSM Owner
- Options: `["All", ...CSM_LIST]` (5 options total). `"All"` is a sentinel — it does **not** represent the union of the 4 CSMs.
- Default: `["All"]`.
- Behavior:
  - If `"All"` is in the selection (or selection is empty) → **scorecard tiles include every opportunity in the dataset**, including opps owned by people who are NOT in `CSM_LIST` (e.g., former CSMs, sales, partner managers). This matches the source Salesforce dashboard's behavior.
  - If only specific CSMs are selected → narrow rows to those owners.
- **Charts always restrict the x-axis to `CSM_LIST` only**, even when `"All"` is selected. Non-CSM owners never appear as a bar.

This split is intentional: the SF dashboard quietly over-counts in its totals while displaying only the CSM team in its bars. We preserve that quirk for parity.

---

## 9. Layout

Single page, no sidebar. Target a 1500px max-width container, centered.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CSM Book of Business              (caption: targets + last updated)     │
├─────────────────────────────────────────────────────────────────────────┤
│  [ Quarter multi-select ]           [ CSM multi-select ]                 │
├─────────────────────────────────────────────────────────────────────────┤
│  PROJECTED & GAPS                                                        │
│  ┌──────────────────┐ ┌───────────┐ ┌──────────────────┐ ┌───────────┐ │
│  │ Projected GRR%   │ │ % GRR Gap │ │ % Book in Risk   │ │ High Risk │ │
│  │ (chart)          │ │           │ │ (chart)          │ │ Renewal   │ │
│  │                  │ │ Target    │ │                  │ │           │ │
│  │                  │ │ GRR Gap   │ │                  │ │ Expected  │ │
│  │                  │ │           │ │                  │ │ Churn     │ │
│  └──────────────────┘ └───────────┘ └──────────────────┘ └───────────┘ │
│  ┌──────────────────┐ ┌───────────┐ ┌──────────────────┐ ┌───────────┐ │
│  │ Projected NRR%   │ │ % NRR Gap │ │                  │ │           │ │
│  │ (chart)          │ │           │ │  (reserved for   │ │ (reserved)│ │
│  │                  │ │ NRR Gap   │ │   Report 2)      │ │           │ │
│  └──────────────────┘ └───────────┘ └──────────────────┘ └───────────┘ │
├─────────────────────────────────────────────────────────────────────────┤
│  NRR & GRR ACTUALS                                                       │
│  ┌──────────────────┐ ┌────────────────┐ ┌──────────────────┐          │
│  │ GRR% Actuals     │ │ Renewal        │ │ NRR% Actuals     │          │
│  │ (chart)          │ │ Remaining      │ │ (chart)          │          │
│  │                  │ │                │ │                  │          │
│  │                  │ │ Closed-Won     │ │                  │          │
│  │                  │ │ Renewal        │ │                  │          │
│  └──────────────────┘ └────────────────┘ └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

Column ratios: `3 : 1.3 : 3 : 1.3` for the first two rows; `3 : 1.8 : 3` for the actuals row. Use CSS grid or Tailwind's `grid-cols-12` (e.g., `col-span-4`, `col-span-2`).

---

## 10. Visual design

- **Type:** Inter or system sans-serif. Tight, dashboard-y.
- **Section headers:** small uppercase, letter-spaced, with a 2px bottom border. NOT large `h1`/`h2`.
- **Cards:** white background, 1px `#e5e7eb` border, 10px radius, subtle 1-px shadow. Padding ~16px.
  - Label row: uppercase, 0.78rem, gray (`#6b7280`), letter-spaced.
  - Value row: ~1.85rem, 650 weight, color toned to status (red `#dc2626` for negative-direction KPIs, green `#059669` for positive, gray `#111827` for neutral).
  - Optional subtitle row: 0.75rem, `#9ca3af`.
- **Quarter palette (Recharts):**
  - `Q1 CY2026` → `#1f77b4` (blue)
  - `Q2 CY2026` → `#56b4e9` (cyan)
  - `Q3 CY2026` → `#7b3fbb` (purple)
  - `Q4 CY2026` → `#c094df` (light purple)
- **Charts:**
  - White plot bg, no grid except very faint horizontal lines.
  - Hide Recharts tooltip cursor highlight; use a clean rounded tooltip.
  - Bar text labels on top of bars showing the percentage (`4.1%`).
  - Target line: dotted gray, with a small "95% target" label at the top-right.
  - Height ~300px.
  - Legend below the chart, horizontal, no title.
- **No emojis. No marketing language. No drop shadows on text.**

---

## 11. Acceptance criteria (smoke test)

With the dashboard at **default state** (all quarters selected, `"All"` selected for CSM), these 7 tiles must read within ±1% of the SF reference values:

| Tile | Expected |
|---|---|
| % GRR Gap | 4.1% |
| % NRR Gap | 10.5% |
| Target GRR Gap | $170K |
| NRR Gap | $437K |
| FY26 ARR High Risk Renewal | $137K |
| FY26 ARR Expected Churn | $8K |
| Closed-Won Renewal | $2.2M |

Renewal Remaining will read ≈ $3.8M (the SF screenshot showed $1.8M but the Sheet has been refreshed since; the formula is correct as written).

When **only "Aastha Jindal" is selected** in the CSM filter, all scorecard tiles must narrow to just her opportunities. The CSM × Quarter charts must show only Aastha's bars.

When **"All"** is selected, the CSM × Quarter charts must still show only the 4 CSMs in `CSM_LIST` on the x-axis (no Brooks, Mark, or Saumitra), even though tiles include their contribution.

---

## 12. Out of scope (do NOT build in v1)

- The 3 reserved widgets (Expansion donut, Renewal % Upgrade, Standalone Expansion %) — leave the grid cells empty or render a `Coming soon` placeholder.
- Drill-down to an opp list — the Sheet doesn't include `Opportunity.Id` yet.
- Authentication / SSO.
- Mobile responsiveness — desktop only is fine for v1.
- Salesforce API direct integration — we're sticking with the Sheet for now. Wrap the data fetch in a single module so it can be swapped later.
- Editable targets — 95% / 110% are hardcoded for now.
- "Refresh now" button — `revalidate: 600` is enough.

---

## 13. Confirm before coding

Ask the user about these only if your design depends on them:

1. **Hosting target.** Local-only (run `pnpm dev`) for v1? Or should the build be ready to deploy to Vercel? (Default: local-only.)
2. **Recharts vs Tremor.** This brief assumes Recharts. If you'd prefer Tremor's pre-styled dashboard primitives, confirm.
3. **Closed-quarter behavior.** When the user filters to a quarter that has already ended, should "Projected" tiles still render (they'll be ≈ Actuals at that point) or hide? (Default: still render, no special handling.)

Everything else is locked. Proceed.

---

## 14. File structure (suggested)

```
/app
  /(dashboard)
    page.tsx              -- server component, fetches + parses CSV
    Filters.tsx           -- client component for the two multi-selects
    Sections.tsx          -- A1 + A2 grid layout
    components/
      StatCard.tsx
      CsmQuarterChart.tsx
      SectionHeader.tsx
/lib
  data/
    fetchReport.ts        -- gviz fetch + CSV parse + cleanup pipeline
    types.ts              -- Row, MetricFn, constants
  metrics.ts              -- the 13 metric functions
  format.ts               -- fmtCurrency, fmtPct
  filters.ts              -- applyFilters(rows, sel) helper
```

---

## 15. Done definition

- Builds cleanly with `pnpm build`.
- All 13 widgets render with live data from the Sheet.
- Acceptance numbers in §11 match.
- No Deploy button, no "Made with X" footer, no Streamlit-style hamburger menu.
- Page loads under 2s on first paint locally.
