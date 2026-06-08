"use client";

import { useMemo } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ALL_CSM, CSM_COL, QUARTER_COL } from "@/lib/constants";
import type { Row } from "@/lib/data/types";
import {
  forecastCategory,
  type ForecastCategory,
} from "@/lib/data/fetchExpansion";
import { fmtCurrency } from "@/lib/format";

export type ExpansionDonutProps = {
  rows: Row[];
  quarterSel: string[];
  csmSel: string[];
};

const CATEGORY_ORDER: ForecastCategory[] = [
  "Pipeline",
  "Best Case",
  "Commit",
  "Closed",
  "Omitted",
];

const CATEGORY_COLORS: Record<ForecastCategory, string> = {
  Pipeline: "#1f77b4",
  "Best Case": "#3a92d4",
  Commit: "#56b4e9",
  Closed: "#7b3fbb",
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

export function ExpansionDonut({ rows, quarterSel, csmSel }: ExpansionDonutProps) {
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
      const cat = forecastCategory(String(r["Stage"] ?? ""));
      const amount = toAmount(r["Amount"]);
      let b = buckets.get(cat);
      if (!b) {
        b = { category: cat, value: 0, count: 0 };
        buckets.set(cat, b);
      }
      b.value += amount;
      b.count += 1;
    }

    const segments = CATEGORY_ORDER.filter((c) => buckets.has(c)).map(
      (c) => buckets.get(c)!,
    );
    const total = segments.reduce((s, x) => s + x.value, 0);
    return { segments, total };
  }, [rows, quarterSel, csmSel]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,22,53,0.04)] transition hover:shadow-[0_4px_16px_-6px_rgba(15,22,53,0.08)]">
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
          Expansion Opps · Q1–Q4
        </div>
        <div className="text-[0.7rem] text-ink-subtle">All forecast categories</div>
      </div>

      {segments.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-ink-subtle">
          No expansion opps in the current selection.
        </div>
      ) : (
        <div className="relative flex flex-1 items-center justify-center">
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-[0.7rem] uppercase tracking-[0.08em] text-ink-subtle">
              Sum of Amount
            </div>
            <div className="text-[1.85rem] font-w650 leading-tight text-ink">
              {fmtCurrency(total)}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={segments}
                dataKey="value"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                stroke="#ffffff"
                strokeWidth={2}
              >
                {segments.map((s) => (
                  <Cell
                    key={s.category}
                    fill={CATEGORY_COLORS[s.category]}
                  />
                ))}
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
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) => {
                  const seg = segments.find((s) => s.category === value);
                  if (!seg) return value;
                  const share = total > 0 ? (seg.value / total) * 100 : 0;
                  return (
                    <span className="text-ink-muted">
                      {value}{" "}
                      <span className="text-ink-subtle">
                        ({fmtCurrency(seg.value)} · {share.toFixed(1)}%)
                      </span>
                    </span>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
