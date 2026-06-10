"use client";

import { useMemo } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ALL_CSM, CSM_COL, QUARTER_COL } from "@/lib/constants";
import type { Row } from "@/lib/data/types";
import {
  forecastCategoryFromRow,
  type ForecastCategory,
} from "@/lib/data/fetchExpansion";
import { fmtCurrency } from "@/lib/format";

export type ExpansionDonutProps = {
  rows: Row[];
  quarterSel: string[];
  csmSel: string[];
  /** Multi-select category filter shared with the Expansion Opportunities
   * table below the chart. Selected segments highlight; non-selected dim. */
  selectedCategories?: Set<ForecastCategory>;
  /** Toggle handler — parent flips membership in the set. */
  onCategoryClick?: (cat: ForecastCategory) => void;
};

const CATEGORY_ORDER: ForecastCategory[] = [
  "Pipeline",
  "Most Likely",
  "Commit",
  "Closed Won",
  "Closed Lost",
  "Omitted",
];

const CATEGORY_COLORS: Record<ForecastCategory, string> = {
  Pipeline: "#1f77b4",
  "Most Likely": "#3a92d4",
  Commit: "#56b4e9",
  "Closed Won": "#059669",
  "Closed Lost": "#DC2626",
  Omitted: "#9ca3af",
};

function toAmount(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

type Segment = {
  category: ForecastCategory;
  value: number;
  count: number;
};

export function ExpansionDonut({
  rows,
  quarterSel,
  csmSel,
  selectedCategories,
  onCategoryClick,
}: ExpansionDonutProps) {
  const clickable = Boolean(onCategoryClick);
  const anySelected = (selectedCategories?.size ?? 0) > 0;
  const { segments, total } = useMemo(() => {
    const allCsmActive = csmSel.length === 0 || csmSel.includes(ALL_CSM);
    let pool = rows;
    if (quarterSel.length > 0) {
      pool = pool.filter((r) =>
        quarterSel.includes(String(r[QUARTER_COL] ?? "")),
      );
    }
    if (!allCsmActive) {
      pool = pool.filter((r) => csmSel.includes(String(r[CSM_COL] ?? "")));
    }

    const buckets = new Map<ForecastCategory, Segment>();
    for (const r of pool) {
      const cat = forecastCategoryFromRow(r);
      const amount = toAmount(r["Amount"]);
      let b = buckets.get(cat);
      if (!b) {
        b = { category: cat, value: 0, count: 0 };
        buckets.set(cat, b);
      }
      b.value += amount;
      b.count += 1;
    }

    // Emit ALL CATEGORY_ORDER entries — empty categories carry value=0/count=0
    // so they still show up in the legend below the chart. Pie slices are
    // filtered to non-zero downstream so the donut itself doesn't render
    // invisible cells.
    const segments = CATEGORY_ORDER.map(
      (c) => buckets.get(c) ?? { category: c, value: 0, count: 0 },
    );
    const total = segments.reduce((s, x) => s + x.value, 0);
    return { segments, total };
  }, [rows, quarterSel, csmSel]);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-xl border border-line bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,22,53,0.04)] transition hover:shadow-[0_4px_16px_-6px_rgba(15,22,53,0.08)]">
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          Expansion Opps · Q1–Q4
        </div>
        <div className="text-[0.7rem] text-ink-subtle">
          {anySelected
            ? `${selectedCategories!.size} selected · click to toggle`
            : clickable
              ? "click a slice to filter"
              : "All forecast categories"}
        </div>
      </div>
      {clickable ? (
        <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[0.72rem] leading-snug text-amber-800">
          <span aria-hidden className="mt-px text-amber-600">💡</span>
          <span>
            Tip: Click any slice to filter the{" "}
            <span className="font-semibold">Expansion Opportunities</span> table
            below. Click again to deselect, or click another slice to add it to
            the filter.
          </span>
        </div>
      ) : null}
      <div className="mb-2 text-[0.66rem] text-ink-subtle">
        Chart shows every forecast category present in the data. Metric tiles
        above only count <span className="font-medium">Commit + Closed-Won</span>.
      </div>

      {segments.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-ink-subtle">
          No expansion opps in the current selection.
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
        <div className="relative flex flex-1 items-center justify-center">
          {(() => {
            const filteredSegments = anySelected
              ? segments.filter((s) => selectedCategories!.has(s.category))
              : segments;
            const centerTotal = filteredSegments.reduce(
              (a, s) => a + s.value,
              0,
            );
            return (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-subtle">
                  {anySelected ? "Selected Amount" : "Sum of Amount"}
                </div>
                <div className="text-[1.85rem] font-w650 leading-tight text-ink">
                  {fmtCurrency(centerTotal)}
                </div>
                {anySelected ? (
                  <div className="mt-0.5 max-w-[160px] text-center text-[0.62rem] leading-snug text-ink-subtle">
                    {Array.from(selectedCategories!).join(" + ")}
                  </div>
                ) : null}
              </div>
            );
          })()}
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={segments.filter((s) => s.value > 0)}
                dataKey="value"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                stroke="#ffffff"
                strokeWidth={2}
                onClick={
                  clickable
                    ? (entry: unknown) => {
                        const p = entry as { category?: ForecastCategory };
                        if (p?.category) onCategoryClick!(p.category);
                      }
                    : undefined
                }
                style={clickable ? { cursor: "pointer" } : undefined}
              >
                {segments
                  .filter((s) => s.value > 0)
                  .map((s) => {
                    const isSelected =
                      selectedCategories?.has(s.category) ?? false;
                    const dimmed = anySelected && !isSelected;
                    return (
                      <Cell
                        key={s.category}
                        fill={CATEGORY_COLORS[s.category]}
                        stroke={isSelected ? "#1f1f1f" : "#ffffff"}
                        strokeWidth={isSelected ? 3 : 2}
                        fillOpacity={dimmed ? 0.35 : 1}
                      />
                    );
                  })}
              </Pie>
              <Tooltip
                cursor={{ fill: "transparent" }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const p = payload[0];
                  const seg = p.payload as Segment;
                  const share = total > 0 ? (seg.value / total) * 100 : 0;
                  return (
                    <div className="rounded-md border border-line bg-white p-2 text-xs shadow-md">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[seg.category] }}
                        />
                        <span className="font-medium text-ink">{seg.category}</span>
                      </div>
                      <div className="mt-1 text-ink-muted">
                        {fmtCurrency(seg.value)} · {share.toFixed(1)}%
                      </div>
                      <div className="text-[0.65rem] text-ink-subtle">
                        {seg.count} opp{seg.count === 1 ? "" : "s"}
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

          {/* Custom legend — only categories that have rows in the current
              filter. Each chip is clickable when the donut is interactive. */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.7rem] text-ink-muted">
            {segments
              .filter((s) => s.value > 0)
              .map((s) => {
                const share = total > 0 ? (s.value / total) * 100 : 0;
                const isSelected =
                  selectedCategories?.has(s.category) ?? false;
                const dim = anySelected && !isSelected;
                const Wrapper: "button" | "span" = clickable ? "button" : "span";
                return (
                  <Wrapper
                    key={s.category}
                    {...(clickable
                      ? {
                          type: "button" as const,
                          onClick: () => onCategoryClick!(s.category),
                        }
                      : {})}
                    className={
                      "inline-flex items-center gap-1.5 rounded px-1 transition-opacity " +
                      (dim ? "opacity-50 " : "") +
                      (clickable ? "cursor-pointer hover:opacity-100" : "")
                    }
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[s.category] }}
                    />
                    <span>{s.category}</span>
                    <span className="text-ink-subtle">
                      ({fmtCurrency(s.value)} · {share.toFixed(1)}%)
                    </span>
                  </Wrapper>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

