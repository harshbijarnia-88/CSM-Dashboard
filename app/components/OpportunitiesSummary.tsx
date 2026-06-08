"use client";

import clsx from "clsx";
import { useMemo } from "react";
import type { Row } from "@/lib/data/types";
import { fmtCurrency } from "@/lib/format";

export type Bucket =
  | "renew"
  | "upgrade"
  | "downgrade"
  | "risk"
  | "churn"
  | "unspecified";

export type BucketSpec = {
  key: Bucket;
  label: string;
  color: string;
};

export const BUCKETS: BucketSpec[] = [
  { key: "renew", label: "Likely to Renew", color: "#059669" },
  { key: "upgrade", label: "Likely to Upgrade", color: "#10B981" },
  { key: "downgrade", label: "Likely to Downgrade", color: "#84CC16" },
  { key: "risk", label: "High Risk Renewal", color: "#D97706" },
  { key: "churn", label: "Expected Churn", color: "#DC2626" },
];

const HEALTHY_KEYS: Bucket[] = ["renew", "upgrade", "downgrade"];

const UNSPECIFIED: BucketSpec = {
  key: "unspecified",
  label: "Unspecified",
  color: "#9CA3AF",
};

function toAmount(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function classifyBucket(r: Row): Bucket {
  const rs = String(r["Renewal Status"] ?? "").trim().toLowerCase();
  if (!rs) return "unspecified";
  if (rs.includes("upgrade")) return "upgrade";
  if (rs.includes("downgrade")) return "downgrade";
  if (rs.includes("renew") && !rs.includes("risk")) return "renew";
  if (rs.includes("risk")) return "risk";
  if (rs.includes("churn")) return "churn";
  return "unspecified";
}

type Tally = { count: number; amount: number };

export type OpportunitiesSummaryProps = {
  rows: Row[];
};

export function OpportunitiesSummary({ rows }: OpportunitiesSummaryProps) {
  const tallies = useMemo(() => {
    const t: Record<Bucket, Tally> = {
      renew: { count: 0, amount: 0 },
      upgrade: { count: 0, amount: 0 },
      downgrade: { count: 0, amount: 0 },
      risk: { count: 0, amount: 0 },
      churn: { count: 0, amount: 0 },
      unspecified: { count: 0, amount: 0 },
    };
    for (const r of rows) {
      const b = classifyBucket(r);
      t[b].count += 1;
      t[b].amount += toAmount(r["Amount"]);
    }
    return t;
  }, [rows]);

  // "Categorized" excludes Unspecified so the % is meaningful.
  const categorizedAmount = BUCKETS.reduce(
    (a, b) => a + tallies[b.key].amount,
    0,
  );
  const totalCount = rows.length;
  const healthyAmount = HEALTHY_KEYS.reduce((a, k) => a + tallies[k].amount, 0);
  const healthyCount = HEALTHY_KEYS.reduce((a, k) => a + tallies[k].count, 0);
  const healthyShare =
    categorizedAmount > 0 ? healthyAmount / categorizedAmount : 0;

  return (
    <div className="mb-4 grid grid-cols-12 gap-4">
      {/* Healthy renewal vs Other split */}
      <div className="col-span-12 flex flex-col gap-3 rounded-xl border border-line bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Healthy vs Other (by amount)
          </div>
          <div className="text-[0.72rem] tabular-nums text-ink-subtle">
            {fmtCurrency(categorizedAmount)} categorized
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div>
            <div className="text-[2rem] font-w650 leading-none text-success">
              {(healthyShare * 100).toFixed(1)}%
            </div>
            <div className="text-[0.72rem] text-ink-subtle">
              {healthyCount} opps · {fmtCurrency(healthyAmount)} healthy
            </div>
            <div className="text-[0.68rem] text-ink-subtle">
              Renew + Upgrade + Downgrade
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <StackedBar tallies={tallies} totalAmount={categorizedAmount} />
            <HealthyMarker tallies={tallies} totalAmount={categorizedAmount} />
          </div>
        </div>

        <Legend />

        {tallies.unspecified.count > 0 ? (
          <div className="border-t border-line/70 pt-2 text-[0.72rem] text-ink-subtle">
            <span className="font-medium text-ink-muted">
              {tallies.unspecified.count}
            </span>{" "}
            opp{tallies.unspecified.count === 1 ? "" : "s"} ·{" "}
            {fmtCurrency(tallies.unspecified.amount)} have no renewal status set
            and are excluded from the split.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function HealthyMarker({
  tallies,
  totalAmount,
}: {
  tallies: Record<Bucket, Tally>;
  totalAmount: number;
}) {
  if (totalAmount <= 0) return null;
  const healthyAmount = HEALTHY_KEYS.reduce(
    (a, k) => a + tallies[k].amount,
    0,
  );
  const healthyPct = (healthyAmount / totalAmount) * 100;
  if (healthyPct <= 0) return null;
  return (
    <div className="relative h-3">
      <div
        className="absolute left-0 flex items-center"
        style={{ width: `${healthyPct}%` }}
      >
        <span
          aria-hidden
          className="h-[1px] flex-1 bg-success/40"
          style={{ marginRight: 4 }}
        />
        <span className="text-[0.62rem] font-medium uppercase tracking-[0.08em] text-success">
          Healthy
        </span>
        <span
          aria-hidden
          className="ml-1 h-[1px] flex-1 bg-success/40"
        />
      </div>
    </div>
  );
}

function StackedBar({
  tallies,
  totalAmount,
}: {
  tallies: Record<Bucket, Tally>;
  totalAmount: number;
}) {
  if (totalAmount <= 0) {
    return (
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full w-full bg-gray-100" />
      </div>
    );
  }
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100 ring-1 ring-inset ring-line">
      {BUCKETS.map((b) => {
        const w = (tallies[b.key].amount / totalAmount) * 100;
        if (w <= 0) return null;
        return (
          <div
            key={b.key}
            className="h-full"
            style={{ width: `${w}%`, backgroundColor: b.color }}
            title={`${b.label}: ${fmtCurrency(tallies[b.key].amount)}`}
          />
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem] text-ink-muted">
      {BUCKETS.map((b) => (
        <span key={b.key} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={clsx("inline-block h-2 w-2 rounded-full")}
            style={{ backgroundColor: b.color }}
          />
          {b.label}
        </span>
      ))}
    </div>
  );
}

export const BUCKET_COLOR: Record<Bucket, string> = {
  renew: BUCKETS[0].color,
  upgrade: BUCKETS[1].color,
  downgrade: BUCKETS[2].color,
  risk: BUCKETS[3].color,
  churn: BUCKETS[4].color,
  unspecified: UNSPECIFIED.color,
};

export const BUCKET_LABEL: Record<Bucket, string> = {
  renew: BUCKETS[0].label,
  upgrade: BUCKETS[1].label,
  downgrade: BUCKETS[2].label,
  risk: BUCKETS[3].label,
  churn: BUCKETS[4].label,
  unspecified: UNSPECIFIED.label,
};
