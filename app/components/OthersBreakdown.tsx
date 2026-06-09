"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { Row } from "@/lib/data/types";
import { fmtCurrency } from "@/lib/format";
import {
  BUCKETS,
  BUCKET_COLOR,
  BUCKET_LABEL,
  classifyBucket,
  type Bucket,
} from "./OpportunitiesSummary";

const HEALTHY_BUCKETS: Bucket[] = ["renew", "upgrade", "downgrade"];

function toAmount(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

type StatusGroup = {
  status: string;
  bucket: Bucket;
  count: number;
  amount: number;
  priorCv: number;
  priorCvOpen: number;
  priorCvWon: number;
  priorCvLost: number;
};

export type OthersBreakdownProps = {
  rows: Row[];
  /** Set of currently-selected statuses (multi-select). Empty = all visible at full brightness. */
  selectedStatuses?: Set<string>;
  /** Click handler — parent toggles membership in the set. */
  onSelectStatus?: (status: string) => void;
};

export function OthersBreakdown({
  rows,
  selectedStatuses,
  onSelectStatus,
}: OthersBreakdownProps) {
  const {
    groups,
    otherTotal,
    otherCount,
    otherPriorCv,
    bucketAmount,
    bucketCount,
  } = useMemo(() => {
    const map = new Map<string, StatusGroup>();
    let otherTotal = 0;
    let otherCount = 0;
    let otherPriorCv = 0;
    const bucketAmount: Record<Bucket, number> = {
      renew: 0,
      upgrade: 0,
      downgrade: 0,
      risk: 0,
      churn: 0,
      unspecified: 0,
    };
    const bucketCount: Record<Bucket, number> = {
      renew: 0,
      upgrade: 0,
      downgrade: 0,
      risk: 0,
      churn: 0,
      unspecified: 0,
    };

    for (const r of rows) {
      const bucket = classifyBucket(r);
      const status =
        String(r["Renewal Status"] ?? "").trim() || "Unspecified";
      const amount = toAmount(r["Amount"]);
      const priorCv = toAmount(r["Prior Contract Value"]);
      const stage = String(r["Stage"] ?? "").toLowerCase();
      // Split every row's Prior CV by Stage so each category surfaces the
      // open-vs-closed distinction. Any "closed-but-not-won" (lost,
      // pre-provisioning, etc.) is rolled into Lost.
      let cvOpen = 0;
      let cvWon = 0;
      let cvLost = 0;
      if (stage.includes("closed won")) {
        cvWon = priorCv;
      } else if (stage.includes("closed")) {
        cvLost = priorCv;
      } else {
        cvOpen = priorCv;
      }

      otherTotal += amount;
      otherPriorCv += priorCv;
      otherCount += 1;
      bucketAmount[bucket] += amount;
      bucketCount[bucket] += 1;

      let g = map.get(status);
      if (!g) {
        g = {
          status,
          bucket,
          count: 0,
          amount: 0,
          priorCv: 0,
          priorCvOpen: 0,
          priorCvWon: 0,
          priorCvLost: 0,
        };
        map.set(status, g);
      }
      g.count += 1;
      g.amount += amount;
      g.priorCv += priorCv;
      g.priorCvOpen += cvOpen;
      g.priorCvWon += cvWon;
      g.priorCvLost += cvLost;
    }

    // Fixed bucket order: positive → neutral → negative.
    const bucketOrder: Record<Bucket, number> = {
      renew: 0,
      upgrade: 1,
      downgrade: 2,
      risk: 3,
      churn: 4,
      unspecified: 5,
    };
    return {
      groups: Array.from(map.values()).sort((a, b) => {
        const ba = bucketOrder[a.bucket];
        const bb = bucketOrder[b.bucket];
        if (ba !== bb) return ba - bb;
        return b.amount - a.amount;
      }),
      otherTotal,
      otherCount,
      otherPriorCv,
      bucketAmount,
      bucketCount,
    };
  }, [rows]);

  // Healthy vs Other roll-up (folded in from the previous OpportunitiesSummary
  // tile so the panel covers both the click-to-filter cards and the overall
  // renewal health snapshot in a single section).
  const categorizedAmount = BUCKETS.reduce(
    (acc, b) => acc + bucketAmount[b.key],
    0,
  );
  const healthyAmount = HEALTHY_BUCKETS.reduce(
    (acc, k) => acc + bucketAmount[k],
    0,
  );
  const healthyCount = HEALTHY_BUCKETS.reduce(
    (acc, k) => acc + bucketCount[k],
    0,
  );
  const healthyShare =
    categorizedAmount > 0 ? healthyAmount / categorizedAmount : 0;

  if (otherCount === 0) return null;

  const clickable = Boolean(onSelectStatus);
  const selectionCount = selectedStatuses?.size ?? 0;
  const anySelected = selectionCount > 0;

  return (
    <div className="mb-4 rounded-xl border border-line bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-ink-muted">
            By Renewal Status
          </div>
          {clickable ? (
            anySelected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[0.65rem] font-medium text-brand-700 ring-1 ring-brand-300">
                Showing: {selectionCount} of {groups.length} ·{" "}
                <span className="text-brand-600">click another to add</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-medium text-ink-muted">
                Showing: All ·{" "}
                <span className="text-ink-subtle">
                  click one or many to filter
                </span>
              </span>
            )
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-medium text-ink-muted">
              all categories
            </span>
          )}
        </div>
        <div className="text-[0.72rem] tabular-nums text-ink-subtle">
          {otherCount} opps · {fmtCurrency(otherTotal)} amount ·{" "}
          {fmtCurrency(otherPriorCv)} prior CV
        </div>
      </div>

      {clickable ? (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[0.72rem] leading-snug text-amber-800">
          <span aria-hidden className="mt-px text-amber-600">💡</span>
          <span>
            Tip: Select{" "}
            <span className="font-semibold">High Risk Renewal</span> and{" "}
            <span className="font-semibold">Expected Churn</span> to see open
            opportunities likely driving the NRR gap.
          </span>
        </div>
      ) : null}

      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))`,
        }}
      >
        {groups.map((g) => {
          const share = otherTotal > 0 ? g.amount / otherTotal : 0;
          const color = BUCKET_COLOR[g.bucket];
          const isSelected = selectedStatuses?.has(g.status) ?? false;
          // When a selection exists, non-selected cards dim to ~50%; the chosen
          // ones stay full-brightness so the eye lands on them immediately.
          const isDimmed = clickable && anySelected && !isSelected;
          const shareSegments: {
            value: number;
            color: string;
            label: string;
          }[] = [
            { value: g.priorCvOpen, color: "#94A3B8", label: "open" },
            { value: g.priorCvWon, color: "#059669", label: "won" },
            { value: g.priorCvLost, color: "#DC2626", label: "lost" },
          ].filter((s) => s.value > 0);
          return (
            <div
              key={g.status}
              {...(clickable
                ? {
                    role: "button",
                    tabIndex: 0,
                    onClick: () => onSelectStatus!(g.status),
                    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectStatus!(g.status);
                      }
                    },
                  }
                : {})}
              aria-pressed={clickable ? isSelected : undefined}
              className={clsx(
                "group relative overflow-hidden rounded-lg border bg-white px-2.5 py-2 transition-all",
                clickable && "cursor-pointer",
                isSelected
                  ? "border-brand-400 bg-brand-50 shadow-[0_2px_8px_-2px_rgba(123,79,231,0.22)] ring-1 ring-brand-300"
                  : clickable
                  ? "border-line shadow-sm hover:-translate-y-[1px] hover:border-brand-200 hover:bg-brand-50/40 hover:shadow-[0_3px_10px_-3px_rgba(15,22,53,0.08)]"
                  : "border-line",
                isDimmed && "opacity-50 hover:opacity-100",
              )}
            >
              {/* Left color stripe */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ backgroundColor: color }}
              />
              {/* Subtle "click to filter" affordance — chevron in the top-right */}
              {clickable ? (
                <span
                  aria-hidden
                  className={clsx(
                    "absolute right-1.5 top-1.5 text-[0.7rem] transition-colors",
                    isSelected
                      ? "text-brand-600"
                      : "text-ink-subtle/0 group-hover:text-brand-500",
                  )}
                >
                  {isSelected ? "●" : "▸"}
                </span>
              ) : null}
              <div className="ml-1 flex flex-col gap-1">
                {/* Status label */}
                <div className="flex items-center gap-1.5 leading-tight">
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate text-[0.74rem] font-semibold text-ink">
                    {g.status}
                  </span>
                </div>
                {/* Count + share % */}
                <div className="flex items-baseline justify-between text-[0.68rem] tabular-nums text-ink-muted">
                  <span>
                    {g.count} opp{g.count === 1 ? "" : "s"}
                  </span>
                  <span className="font-medium text-ink-subtle">
                    {(share * 100).toFixed(0)}%
                  </span>
                </div>
                {/* Amount */}
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.6rem] uppercase tracking-[0.06em] text-ink-subtle">
                    Amount
                  </span>
                  <span className="text-[0.9rem] font-w650 tabular-nums text-ink">
                    {fmtCurrency(g.amount)}
                  </span>
                </div>
                {/* Prior CV with mini split bar */}
                <div className="flex items-baseline justify-between">
                  <span className="text-[0.6rem] uppercase tracking-[0.06em] text-ink-subtle">
                    Prior CV
                  </span>
                  <span className="text-[0.8rem] tabular-nums text-ink-muted">
                    {fmtCurrency(g.priorCv)}
                  </span>
                </div>
                {shareSegments.length > 0 ? (
                  <SegmentBar
                    segments={shareSegments}
                    total={g.priorCv}
                  />
                ) : null}
                {/* Bottom: share-of-amount bar */}
                <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(3, share * 100)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Healthy vs Other roll-up — folded in from the previous separate
          tile so the panel covers both interactive filtering and the overall
          renewal health snapshot. */}
      {categorizedAmount > 0 ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-line/70 pt-3">
          <div className="flex items-center justify-between text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            <span>Projected Renewal ARR by Forecasted Renewal Status</span>
            <span className="tabular-nums text-ink-subtle">
              {fmtCurrency(categorizedAmount)} categorized
            </span>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <div className="text-[1.65rem] font-w650 leading-none text-success">
                {(healthyShare * 100).toFixed(1)}%
              </div>
              <div className="text-[0.7rem] text-ink-subtle">
                {healthyCount} opps · {fmtCurrency(healthyAmount)} projected to
                renew
              </div>
              <div className="text-[0.66rem] text-ink-subtle">
                Renew + Upgrade + Downgrade
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100 ring-1 ring-inset ring-line">
                {BUCKETS.map((b) => {
                  const w = (bucketAmount[b.key] / categorizedAmount) * 100;
                  if (w <= 0) return null;
                  return (
                    <div
                      key={b.key}
                      className="h-full"
                      style={{ width: `${w}%`, backgroundColor: b.color }}
                      title={`${b.label}: ${fmtCurrency(bucketAmount[b.key])}`}
                    />
                  );
                })}
              </div>
              {healthyShare > 0 ? (
                <div className="relative h-3">
                  <div
                    className="absolute left-0 flex items-center"
                    style={{ width: `${healthyShare * 100}%` }}
                  >
                    <span
                      aria-hidden
                      className="mr-1 h-px flex-1 bg-success/40"
                    />
                    <span className="text-[0.6rem] font-medium uppercase tracking-[0.08em] text-success">
                      Projected to Renew
                    </span>
                    <span aria-hidden className="ml-1 h-px flex-1 bg-success/40" />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {bucketAmount.unspecified > 0 ? (
            <div className="text-[0.68rem] text-ink-subtle">
              <span className="font-medium text-ink-muted">
                {bucketCount.unspecified}
              </span>{" "}
              opp{bucketCount.unspecified === 1 ? "" : "s"} ·{" "}
              {fmtCurrency(bucketAmount.unspecified)} have no renewal status set
              and are excluded from the split.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/70 pt-2 text-[0.7rem] text-ink-muted">
        <span className="text-ink-subtle">Color by bucket:</span>
        {(
          ["renew", "upgrade", "downgrade", "risk", "churn", "unspecified"] as Bucket[]
        ).map(
          (b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: BUCKET_COLOR[b] }}
              />
              {BUCKET_LABEL[b]}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function formatShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

// Stacked one-line bar with a floating tooltip on segment hover. Wide
// segments still print their label inline; narrow ones rely on the hover
// tooltip for the exact value + bucket name.
function SegmentBar({
  segments,
  total,
}: {
  segments: { value: number; color: string; label: string }[];
  total: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Pre-compute each segment's width and its center position (% of bar).
  let cum = 0;
  const positions = segments.map((s) => {
    const w = (s.value / total) * 100;
    const center = cum + w / 2;
    cum += w;
    return { center, width: w };
  });

  // Clamp tooltip center so it doesn't spill outside the bar's bounds.
  const hoverPct =
    hoveredIdx !== null && positions[hoveredIdx]
      ? Math.max(8, Math.min(92, positions[hoveredIdx].center))
      : 0;

  return (
    <div
      className="relative"
      onMouseLeave={() => setHoveredIdx(null)}
    >
      <div className="flex h-6 overflow-hidden rounded-md bg-gray-100 ring-1 ring-line/60">
        {segments.map((s, i) => {
          const widthPct = positions[i].width;
          const showInline = widthPct >= 28;
          const isHover = hoveredIdx === i;
          return (
            <div
              key={s.label}
              className={clsx(
                "flex cursor-default items-center justify-center overflow-hidden whitespace-nowrap px-1 text-[0.65rem] font-semibold text-white transition-[filter] duration-150",
                isHover ? "brightness-110" : "",
                hoveredIdx !== null && !isHover ? "opacity-70" : "",
              )}
              style={{
                width: `${widthPct}%`,
                backgroundColor: s.color,
              }}
              onMouseEnter={() => setHoveredIdx(i)}
            >
              {showInline ? `${formatShort(s.value)} ${s.label}` : null}
            </div>
          );
        })}
      </div>
      {hoveredIdx !== null && segments[hoveredIdx] ? (
        <div
          className="pointer-events-none absolute bottom-full z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[0.65rem] font-medium text-white shadow-lg"
          style={{ left: `${hoverPct}%` }}
        >
          <span style={{ color: segments[hoveredIdx].color }}>●</span>{" "}
          <span className="tabular-nums">
            {formatShort(segments[hoveredIdx].value)}
          </span>{" "}
          <span className="capitalize text-white/80">
            {segments[hoveredIdx].label}
          </span>
          {/* tiny arrow pointing down at the segment */}
          <span
            aria-hidden
            className="absolute left-1/2 top-full -mt-px h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-ink"
          />
        </div>
      ) : null}
    </div>
  );
}
