# Requirements — CSM Book of Business Dashboard

## Purpose
Replicate the Salesforce dashboard "CSM Book of Business — Retention and Expansion" as a polished web app that re-derives KPIs client-side from a Google Sheet, supports multi-select Quarter and CSM filters, and renders 13 widgets without Salesforce iframe constraints.

## Stakeholders
- 4 CSMs and CS leadership at Zuddl. Internal, single-tenant, no auth.

## Confirmed (§13)
- Hosting: local-only (`pnpm dev`).
- Charts: Recharts.
- Closed-quarter behavior: Projected tiles always render — no special handling.

## Functional Requirements (EARS)

### Data ingestion
- R1. The system **shall** fetch report rows from the gviz CSV endpoint `https://docs.google.com/spreadsheets/d/1_mnKGada5DP-0uAWJ_Av9RJH1ed1bseQozYVvDEA72o/gviz/tq?tqx=out:csv&gid=0` server-side, with `next: { revalidate: 600 }`.
- R2. When the fetch fails, the system **shall** render an inline error banner with the failure reason and an empty dashboard skeleton (no crash).
- R3. The system **shall** drop SF subtotal rows: any row where `Opportunity Owner` OR `Deal Name` is empty/null.
- R4. The system **shall** coerce each of the 15 input numerics by stripping `$` and `,`, parsing as float, defaulting to `0` on failure.
- R5. The system **shall** rename 6 sheet columns to canonical names per the brief §3 table; all other columns pass through unchanged.

### Filters
- R6. The system **shall** expose a Quarter multi-select whose options are the distinct values of `Opp_closed_date_quarter`, sorted ascending; default is all selected.
- R7. The system **shall** expose a CSM multi-select whose options are `["All", ...CSM_LIST]` (5 items); default is `["All"]`.
- R8. When `"All"` is in the CSM selection (or selection is empty), the system **shall** include every opportunity (including non-CSM_LIST owners) in scorecard tiles.
- R9. When specific CSMs are selected without `"All"`, the system **shall** narrow tile rows to only those owners.
- R10. The system **shall** restrict CSM × Quarter chart x-axis to `CSM_LIST` only at all times, regardless of CSM filter selection.
- R11. The Quarter filter **shall** apply to both scorecard tiles and charts.

### Metrics
- R12. The system **shall** implement the 13 derived metrics in §6 of the brief verbatim, with `safeDiv` returning `NaN` when denominator is `0`.
- R13. The system **shall** compute metrics via sum-then-divide semantics — never per-row ratios.
- R14. The system **shall NOT** "fix" the documented asymmetries between `NRR_Base` and `Base_GRR` denominators.

### Widgets
- R15. The system **shall** render the 13 widgets in §7 of the brief — 9 in Section A (Projected & Gaps), 4 in Section B (NRR & GRR Actuals).
- R16. Aggregate widgets **shall** render as scorecard cards; CSM × Quarter widgets **shall** render as grouped Recharts bar charts.
- R17. Projected GRR% and GRR% Actuals charts **shall** display a dotted 95% target line; Projected NRR% and NRR% Actuals **shall** display a dotted 110% target line.
- R18. The 3 reserved widgets (Expansion donut, Renewal % Upgrade, Standalone Expansion %) **shall** be left as empty grid cells or `Coming soon` placeholders.

### Formatting
- R19. Currency formatting: `≥ $1M → $1.2M`, `≥ $1K → $430K`, `< $1K → $987`.
- R20. Percent formatting: `4.1%` (one decimal).
- R21. Gap-style tiles ("% GRR Gap", "% NRR Gap", "Target GRR Gap", "NRR Gap") **shall** color red when value is positive, green when value is zero or negative.
- R22. "FY26 ARR High Risk Renewal" and "FY26 ARR Expected Churn" **shall** color red. "Closed-Won Renewal" **shall** color green.

### Layout & Visual
- R23. Single page, max-width 1500px, centered, desktop-only.
- R24. Section headers **shall** be small uppercase letter-spaced with 2px bottom border (not large h1/h2).
- R25. Cards **shall** use white background, 1px `#e5e7eb` border, 10px radius, ~16px padding, subtle 1px shadow.
- R26. Quarter colors **shall** be: Q1 `#1f77b4`, Q2 `#56b4e9`, Q3 `#7b3fbb`, Q4 `#c094df`.
- R27. The header **shall** show targets caption and an "Updated X mins ago" timestamp.

### Refresh
- R28. The system **shall** revalidate the upstream fetch every 600 seconds. No manual refresh button.

## Acceptance (smoke test)
With default state (all quarters, `"All"` CSM), within ±1% of:

| Tile | Expected |
|---|---|
| % GRR Gap | 4.1% |
| % NRR Gap | 10.5% |
| Target GRR Gap | $170K |
| NRR Gap | $437K |
| FY26 ARR High Risk Renewal | $137K |
| FY26 ARR Expected Churn | $8K |
| Closed-Won Renewal | $2.2M |

Renewal Remaining ≈ $3.8M (current sheet state).

When `"Aastha Jindal"` only is selected, all tiles and charts narrow to her opps. When `"All"` is selected, charts still show only the 4 CSM_LIST members on x-axis.

## Out of scope (§12)
Reserved widgets, opp drill-down, auth, mobile, direct SF API, editable targets, manual refresh button.

## Done definition (§15)
- `pnpm build` succeeds.
- All 13 widgets render with live data.
- Acceptance numbers above match.
- No deploy button, no "Made with X" footer, no Streamlit hamburger.
- First paint < 2s locally.
