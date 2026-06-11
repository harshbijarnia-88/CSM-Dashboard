"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CSM_COL, CSM_LIST, QUARTER_COL, QUARTER_COLORS } from "@/lib/constants";
import type { Row } from "@/lib/data/types";
import { fmtCurrency, fmtCurrencyFull, fmtPct } from "@/lib/format";

export type CsmQuarterChartProps = {
  title: string;
  metric: (rows: Row[]) => number;
  chartRows: Row[];
  selectedQuarters: string[];
  kind: "percent" | "currency";
  target?: number;
  targetLabel?: string;
  /** Optional formula footer — surfaces the sum-then-divide inputs. */
  formula?: {
    numerator: { label: string; field: string };
    denominator: { label: string; field: string };
  };
  /** Optional row set used ONLY for the "Overall" formula footer. Useful
   * when callers want the footer to reflect the full filtered universe
   * (e.g. tileRows including Unattributed) while the per-CSM bars stay
   * scoped to named CSMs in chartRows. Defaults to chartRows. */
  formulaRows?: Row[];
};

type ChartDatum = { csm: string } & Record<string, string | number>;

function buildData(
  chartRows: Row[],
  selectedQuarters: string[],
  metric: (rows: Row[]) => number,
): ChartDatum[] {
  // Only render CSMs that actually have rows in the current filter. Keeping
  // the canonical CSM_LIST order so the bars don't reshuffle as filters
  // narrow.
  const present = new Set(
    chartRows.map((r) => String(r[CSM_COL] ?? "")).filter(Boolean),
  );
  return CSM_LIST.filter((csm) => present.has(csm)).map((csm) => {
    const datum: ChartDatum = { csm };
    const rowsForCsm = chartRows.filter((r) => r[CSM_COL] === csm);
    for (const q of selectedQuarters) {
      const qRows = rowsForCsm.filter((r) => r[QUARTER_COL] === q);
      const v = metric(qRows);
      datum[q] = Number.isFinite(v) ? v : 0;
    }
    return datum;
  });
}

function CustomTooltip({
  active,
  payload,
  label,
  kind,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  kind: "percent" | "currency";
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-line bg-white p-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-ink">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-ink-muted">{p.name}</span>
          <span className="ml-auto font-medium text-ink">
            {kind === "percent" ? fmtPct(p.value) : fmtCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CsmQuarterChart({
  title,
  metric,
  chartRows,
  selectedQuarters,
  kind,
  target,
  targetLabel,
  formula,
  formulaRows,
}: CsmQuarterChartProps) {
  const data = buildData(chartRows, selectedQuarters, metric);
  const yFmt = (v: number) => (kind === "percent" ? fmtPct(v) : fmtCurrency(v));

  // Overall sum-then-divide totals. Use formulaRows when provided (typically
  // tileRows — the full filtered universe including Unattributed) so the
  // header tiles and the "Overall:" line agree; fall back to chartRows
  // (named-CSM scope) otherwise.
  const overallRows = formulaRows ?? chartRows;
  const formulaTotals = formula
    ? (() => {
        const num = overallRows.reduce(
          (s, r) => s + (Number(r[formula.numerator.field]) || 0),
          0,
        );
        const den = overallRows.reduce(
          (s, r) => s + (Number(r[formula.denominator.field]) || 0),
          0,
        );
        const pct = den === 0 ? NaN : num / den;
        return { num, den, pct };
      })()
    : null;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-line bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,22,53,0.04)] transition hover:shadow-[0_4px_16px_-6px_rgba(15,22,53,0.08)]">
      <div className="mb-1 text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {title}
      </div>
      {formulaTotals ? (
        <div className="mb-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[0.7rem] tabular-nums text-ink-subtle">
          <span>Overall:</span>
          <FormulaNumberWithTooltip
            display={fmtCurrency(formulaTotals.num)}
            full={fmtCurrencyFull(formulaTotals.num)}
          />
          <span className="text-ink-subtle">
            ({formula!.numerator.label})
          </span>
          <span className="text-ink-subtle">÷</span>
          <FormulaNumberWithTooltip
            display={fmtCurrency(formulaTotals.den)}
            full={fmtCurrencyFull(formulaTotals.den)}
          />
          <span className="text-ink-subtle">
            ({formula!.denominator.label})
          </span>
          <span className="text-ink-subtle">=</span>
          <span className="font-medium text-ink">
            {fmtPct(formulaTotals.pct)}
          </span>
        </div>
      ) : null}
      {/* Flex-grow chart area so the card stretches to its pod row's height
          (the donut card next door is taller because of its tip + scope
          notes — grid stretch will pull this card to match). */}
      <div className="min-h-[280px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="csm"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={yFmt}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              cursor={{ fill: "transparent" }}
              content={<CustomTooltip kind={kind} />}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            {target !== undefined ? (
              <ReferenceLine
                y={target}
                stroke="#9ca3af"
                strokeDasharray="4 4"
                label={{
                  value: targetLabel ?? "target",
                  position: "right",
                  fill: "#9ca3af",
                  fontSize: 11,
                }}
              />
            ) : null}
            {selectedQuarters.map((q) => (
              <Bar
                key={q}
                dataKey={q}
                name={q}
                fill={QUARTER_COLORS[q] ?? "#9ca3af"}
                radius={[3, 3, 0, 0]}
                maxBarSize={42}
              >
                {data.map((_, idx) => (
                  <Cell key={idx} fill={QUARTER_COLORS[q] ?? "#9ca3af"} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Instant-feedback hover popover for the chart's "Overall:" line. Uses a
 * CSS group-hover transition so the full-precision $ value (e.g.
 * "$4,234,567") appears below the abbreviated chip ("$4.2M") as soon as
 * the cursor enters — no native title delay. Positioned BELOW the number
 * because the chart card has `overflow-hidden` and a tooltip above the
 * formula line would get clipped at the card boundary.
 */
function FormulaNumberWithTooltip({
  display,
  full,
}: {
  display: string;
  full: string;
}) {
  return (
    <span className="group/formula relative inline-flex">
      <span className="cursor-help font-medium text-ink-muted underline decoration-dotted decoration-ink-subtle/60 underline-offset-2">
        {display}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[0.7rem] font-medium tabular-nums text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover/formula:opacity-100 group-focus-within/formula:opacity-100"
      >
        {full}
        <span
          aria-hidden
          className="absolute -top-px left-1/2 -mt-1 h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-ink"
        />
      </span>
    </span>
  );
}
