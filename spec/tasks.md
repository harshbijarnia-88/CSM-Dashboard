# Tasks — CSM Book of Business Dashboard

Linear, top-to-bottom. Each task ends in a checkable state.

## 1. Project scaffold
- [ ] 1.1 Initialize `package.json` with Next.js 14, React 18, TS 5, Tailwind 3, PapaParse, Recharts, clsx, lucide-react.
- [ ] 1.2 Add `tsconfig.json` (strict mode, App Router defaults).
- [ ] 1.3 Add `next.config.js`, `postcss.config.js`, `tailwind.config.ts`.
- [ ] 1.4 Add `.gitignore` (node_modules, .next, *.log).
- [ ] 1.5 Add `app/globals.css` (Tailwind directives + Inter font import).
- [ ] 1.6 Add `app/layout.tsx` (root layout, html lang, body class).
- [ ] 1.7 Run `npm install`. Confirm clean install.

## 2. Constants & types
- [ ] 2.1 `lib/constants.ts` — CSM_LIST, GRR_TARGET, NRR_TARGET, CSM_COL, QUARTER_COL, QUARTER_COLORS map, GVIZ_URL.
- [ ] 2.2 `lib/data/types.ts` — `Row`, `MetricFn`, `RAW_NUMERIC_COLS` array.

## 3. Data layer
- [ ] 3.1 `lib/data/fetchReport.ts` — fetch + PapaParse + drop subtotals + rename + coerce numerics. Returns `{ rows, fetchedAt }`.
- [ ] 3.2 Sanity log on dev: rows.length, first row keys.

## 4. Pure helpers
- [ ] 4.1 `lib/format.ts` — `fmtCurrency`, `fmtPct`.
- [ ] 4.2 `lib/metrics.ts` — `sum`, `safeDiv`, and the 13 functions verbatim from brief §6.
- [ ] 4.3 `lib/filters.ts` — `applyFilters(rows, quarterSel, csmSel)` returning `{ tileRows, chartRows }`.

## 5. UI primitives
- [ ] 5.1 `app/components/SectionHeader.tsx` — uppercase letter-spaced label with 2px bottom border.
- [ ] 5.2 `app/components/StatCard.tsx` — label / value / optional subtitle, tone color logic, NaN → "—".
- [ ] 5.3 `app/components/MultiSelect.tsx` — popover w/ checkbox list, click-outside close.
- [ ] 5.4 `app/components/Filters.tsx` — two MultiSelects with the CSM-"All" sentinel semantics.
- [ ] 5.5 `app/components/Header.tsx` — title, "Targets: GRR 95% · NRR 110%" caption, "Updated X mins ago".

## 6. Chart
- [ ] 6.1 `app/components/CsmQuarterChart.tsx` — Recharts grouped BarChart per design.
  - 4-row CSM_LIST data shape, one bar per selected quarter.
  - Quarter colors from QUARTER_COLORS.
  - Y-axis formatter by `kind`.
  - Top-of-bar labels.
  - Dotted target line when `target` prop set.
  - Custom tooltip card.

## 7. Sections
- [ ] 7.1 `app/components/SectionA.tsx` — 9 widgets in the documented grid.
- [ ] 7.2 `app/components/SectionB.tsx` — 4 widgets in the documented grid + 1 reserved placeholder.

## 8. Page wiring
- [ ] 8.1 `app/page.tsx` (server) — calls `fetchReport`, renders `<Dashboard rows fetchedAt />`. Error boundary fallback for fetch failure.
- [ ] 8.2 `app/components/Dashboard.tsx` (client) — owns filter state, calls `applyFilters`, passes `tileRows` / `chartRows` to sections.

## 9. Verification
- [ ] 9.1 `npm run dev`, load page locally.
- [ ] 9.2 Verify §11 acceptance numbers (default state, all quarters + "All"). ±1%.
- [ ] 9.3 Switch CSM to "Aastha Jindal" only → tiles + charts narrow.
- [ ] 9.4 With "All" → charts still only show 4 CSM_LIST bars.
- [ ] 9.5 `npm run build` succeeds.

## 10. Cleanup
- [ ] 10.1 No leftover console.logs in commit.
- [ ] 10.2 No emojis. No marketing copy. No Streamlit hamburger.
