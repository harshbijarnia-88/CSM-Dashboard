# Design — CSM Book of Business Dashboard

## Architecture

Server-rendered Next.js 14 App Router page. One round-trip to the gviz endpoint at request time (cached 10 min via `next.revalidate`), parsed and normalized server-side, hydrated into a single client component that owns filter state and renders all 13 widgets.

```
gviz CSV  ──▶  fetchReport.ts (server)  ──▶  Row[] (normalized)
                                                │
                              <Dashboard rows /> (client)
                                  │
                ┌─────────────────┼─────────────────┐
              Filters         Sections           Header
            (state owner)   (consume rows)
                                  │
                          applyFilters(rows, sel)
                                  │
                  ┌───────────────┴───────────────┐
              tileRows                       chartRows
            (includes non-CSM_LIST       (always restricted to
             when "All" selected)         CSM_LIST x-axis)
```

Rationale for client-side filtering: the dataset is ~150 rows. Re-fetching on filter change would be silly. One server fetch → client owns the filter UI + recomputes metrics in milliseconds.

## Module layout

```
app/
  layout.tsx                 root layout, Inter font, Tailwind globals
  page.tsx                   server component: fetches rows, renders <Dashboard />
  globals.css                Tailwind + dashboard tokens
  components/
    Dashboard.tsx            client root — owns filter state, renders header + filters + sections
    Filters.tsx              two MultiSelect controls
    MultiSelect.tsx          popover-style multi-select (built on shadcn primitives)
    Header.tsx               title, targets caption, "Updated X mins ago"
    SectionHeader.tsx        uppercase letter-spaced header w/ 2px border
    StatCard.tsx             aggregate KPI card
    CsmQuarterChart.tsx      grouped bar chart (CSM × Quarter)
    SectionA.tsx             9-cell grid for Projected & Gaps
    SectionB.tsx             3-cell grid for NRR & GRR Actuals
lib/
  data/
    fetchReport.ts           gviz fetch + CSV parse + normalize pipeline
    types.ts                 Row type, MetricFn type, RawNumericCol union
  constants.ts               CSM_LIST, GRR_TARGET, NRR_TARGET, CSM_COL, QUARTER_COL, QUARTER_COLORS
  metrics.ts                 13 metric functions + sum + safeDiv
  format.ts                  fmtCurrency, fmtPct
  filters.ts                 applyFilters(rows, sel) → {tileRows, chartRows}
spec/
  requirements.md  design.md  tasks.md
```

## Data layer (`lib/data/fetchReport.ts`)

1. `fetch(GVIZ_URL, { next: { revalidate: 600 } })`. Throw on non-200.
2. Parse with `papaparse` in header mode (`header: true, skipEmptyLines: true, dynamicTyping: false`).
3. Drop SF subtotal rows: `r["Opportunity Owner"]?.trim() && r["Deal Name"]?.trim()`.
4. Apply rename map (6 keys). Build a fresh object per row to avoid mutating papaparse output.
5. For each of the 15 RAW_NUMERIC_COLS (post-rename), coerce: `Number(String(v).replace(/[$,]/g, "")) || 0`.
6. Return `{ rows: Row[], fetchedAt: ISOString }`.

`Row` type:
```ts
export type Row = Record<string, string | number | null>;
```
Numeric cols hold `number`; everything else is `string | null`. Not strongly typed per-field — the metric functions read by column name and treat unknown as 0.

## Metrics layer (`lib/metrics.ts`)

Verbatim from brief §6. Pure functions, no side effects, no rounding (formatters round at display time).

```ts
export const sum = (rows: Row[], col: string) =>
  rows.reduce((acc, r) => acc + (Number(r[col]) || 0), 0);

export const safeDiv = (a: number, b: number) => (b === 0 ? NaN : a / b);
```

All 13 functions take `Row[]` and return `number`. Aggregate widgets like `FY26 ARR High Risk Renewal` use inline `sum(rows, "ARR_High_Risk_Renewal")` rather than a named metric — kept inline in the widget config to mirror the brief table.

## Filter logic (`lib/filters.ts`)

```ts
export function applyFilters(
  rows: Row[],
  quarterSel: string[],          // [] means "all"
  csmSel: string[],              // includes "All" sentinel or [] means "all"
): { tileRows: Row[]; chartRows: Row[] }
```

Steps:
1. **Quarter narrow** (shared): if `quarterSel.length > 0`, keep rows where `r[QUARTER_COL] ∈ quarterSel`. Else keep all.
2. **Tile rows**: if `csmSel.includes("All") || csmSel.length === 0` → keep all. Else narrow to `r[CSM_COL] ∈ csmSel`.
3. **Chart rows**: same as tileRows, then further restrict to `r[CSM_COL] ∈ CSM_LIST`.

Chart x-axis always spans `CSM_LIST` (4 categories) even when a CSM is missing from the filtered chartRows — the bar group is empty in that case.

## Chart component (`CsmQuarterChart.tsx`)

Recharts `<BarChart>` with grouped bars.

Data shape (one row per CSM, one numeric per selected quarter):
```ts
[
  { csm: "Aastha Jindal", "Q1 CY2026": 0.94, "Q2 CY2026": 0.97, ... },
  ...
] // 4 entries always (CSM_LIST order)
```

Build via:
```ts
const data = CSM_LIST.map(csm => {
  const rowsForCsm = chartRows.filter(r => r[CSM_COL] === csm);
  const cell: Record<string, number | string> = { csm };
  for (const q of selectedQuarters) {
    const qRows = rowsForCsm.filter(r => r[QUARTER_COL] === q);
    cell[q] = metric(qRows);
  }
  return cell;
});
```

Recharts config:
- Width: container 100%, height: 300px.
- `CartesianGrid` horizontal-only, very faint (`#f3f4f6`).
- X-axis: `csm`. Y-axis: percent formatter (`fmtPct`) or currency (`fmtCurrency`) depending on `kind` prop.
- One `<Bar>` per quarter, with `fill` from `QUARTER_COLORS[q]`.
- `<LabelList>` on each Bar showing the percent (top of bar).
- `<ReferenceLine y={target} stroke="#9ca3af" strokeDasharray="3 3" label="95% target" />` when `target` prop is set.
- `<Legend verticalAlign="bottom" iconType="circle" />`.
- `<Tooltip cursor={false} content={<CustomTooltip />} />` — custom tooltip = white card, 1px gray border, rounded.

Props:
```ts
{
  title: string;
  metric: (rows: Row[]) => number;
  chartRows: Row[];
  selectedQuarters: string[];
  kind: "percent" | "currency";
  target?: number; // e.g. 0.95
  targetLabel?: string; // e.g. "95% target"
}
```

## Stat card (`StatCard.tsx`)

```ts
{
  label: string;              // uppercase letter-spaced
  value: number;              // raw metric output
  kind: "percent" | "currency";
  tone?: "red-when-positive" | "red-when-positive-green-zero" | "red" | "green" | "neutral";
  subtitle?: string;
}
```

Tone resolution at render:
- `red-when-positive`: red if `value > 0`, else gray.
- `red-when-positive-green-zero`: red if `value > 0`, green if `value ≤ 0`. Used for the two Gap % tiles per R21.
- `red` / `green` / `neutral`: static.
- `NaN` value → render "—" in neutral gray.

## Filter UX (`Filters.tsx` + `MultiSelect.tsx`)

Two `<MultiSelect>` controls side-by-side at the top.

`MultiSelect` is a popover with checkbox list, built on shadcn `Popover` + `Command` if available. For simplicity (avoid full shadcn `npx` setup overhead), we'll implement a minimal popover-multi-select directly with Tailwind:
- Trigger button: shows selected count or "All quarters" / "All CSMs".
- Popover: list of options with checkboxes, click to toggle.
- Click-outside closes.

Special CSM "All" semantics:
- Selecting "All" clears other selections (mutual sentinel).
- Selecting any specific CSM removes "All".
- If selection becomes empty, snap back to `["All"]` (avoid accidental "no CSMs" state).

## Layout grid

Section A uses Tailwind 12-col grid. Column ratios `3 : 1.3 : 3 : 1.3` → approximate as `col-span-4 col-span-2 col-span-4 col-span-2`.

```
Row 1 of Section A:
  A-1 Projected GRR% (chart)   col-span-4
  A-2 % GRR Gap (card)         col-span-2 — stacked with A-3 inside same col? brief shows stack
  A-4 % Book in Risk (chart)   col-span-4
  A-5 High Risk Renewal (card) col-span-2 — stacked with A-6
```

Brief's ASCII shows A-2 and A-3 stacked (Gap %/Gap $), A-5 and A-6 stacked. Implement that as a `div` with two cards in `flex-col gap-3`.

```
Row 2:
  A-7 Projected NRR% (chart)   col-span-4
  A-8 % NRR Gap stacked w/ A-9 col-span-2
  RESERVED (empty)              col-span-4
  RESERVED (empty)              col-span-2
```

Section B (`3 : 1.8 : 3` ≈ `col-span-5 col-span-2 col-span-5`):
```
  B-1 GRR% Actuals (chart)     col-span-5
  B-2 Renewal Remaining +       col-span-2 (stacked)
  B-3 Closed-Won Renewal
  B-4 NRR% Actuals (chart)     col-span-5
```

## Format helpers (`lib/format.ts`)

```ts
export function fmtCurrency(v: number): string {
  if (Number.isNaN(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function fmtPct(v: number): string {
  if (Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}
```

## Error & loading states

- Server fetch error → page renders error banner above filters + an empty rows array. No crash. Tiles show "—".
- Cold start (no cached fetch) → SSR waits for the fetch; no skeleton needed at < 2s budget for 150 rows + small CSV.

## Performance

- Single fetch (gviz ~few KB). PapaParse on ~150 rows is sub-ms.
- Filter recompute on each filter change is also sub-ms (~150 rows × 13 metrics).
- Recharts re-renders on filter change are fine — no memoization needed for v1.

## Dependencies

```
next ^14
react ^18
typescript ^5
tailwindcss ^3
papaparse ^5
@types/papaparse
recharts ^2
clsx
lucide-react   (for chevron/check icons in MultiSelect)
```

No shadcn full install — we use Tailwind directly. The "shadcn primitives" in the brief are aesthetic guidance; functionally we only need a popover-multi-select which is small enough to hand-roll.

## Trade-offs

- **Hand-rolled MultiSelect vs shadcn install**: shadcn requires `npx shadcn-ui init` which adds config + tailwind preset shuffling. For one component, hand-rolling is faster and keeps the tree clean. Cost: ~80 lines.
- **No memoization**: dataset is small. Adding `useMemo` everywhere would be premature.
- **No charts library wrapper layer**: each chart imports Recharts directly via `CsmQuarterChart`. If we add more chart types later we can pull a wrapper; right now there's just one.
