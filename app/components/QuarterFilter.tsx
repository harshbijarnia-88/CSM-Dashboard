"use client";

import clsx from "clsx";
import {
  FY_OPTIONS,
  QUARTER_COLORS,
  buildQuarterKey,
  currentFiscalYear,
  fyQuarters,
} from "@/lib/constants";

const CURRENT_FY = currentFiscalYear();

export type QuarterFilterProps = {
  selected: string[];
  onChange: (next: string[]) => void;
  counts: Record<string, number>;
  fyOptions?: readonly number[];
};

export function QuarterFilter({
  selected,
  onChange,
  counts,
  fyOptions = FY_OPTIONS,
}: QuarterFilterProps) {
  const selectedSet = new Set(selected);

  function toggleQuarter(key: string) {
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  }

  function toggleFy(fy: number) {
    const keys = fyQuarters(fy);
    const allSelected = keys.every((k) => selectedSet.has(k));
    const next = new Set(selectedSet);
    if (allSelected) {
      keys.forEach((k) => next.delete(k));
    } else {
      keys.forEach((k) => next.add(k));
    }
    onChange(Array.from(next));
  }

  function selectOnlyFy(fy: number) {
    onChange(fyQuarters(fy));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-ink-muted">
          Fiscal Year & Quarters
        </label>
        <button
          type="button"
          onClick={() => selectOnlyFy(CURRENT_FY)}
          className="text-[0.68rem] font-medium text-brand-600 hover:text-brand-700"
        >
          Reset to FY{String(CURRENT_FY).slice(2)}
        </button>
      </div>
      <div className="flex flex-1 flex-col divide-y divide-line/70 rounded-lg border border-line bg-white shadow-card">
        {fyOptions.map((fy) => {
          const keys = fyQuarters(fy);
          const selectedCount = keys.filter((k) => selectedSet.has(k)).length;
          const allSelected = selectedCount === keys.length;
          const someSelected = selectedCount > 0 && !allSelected;
          const isCurrent = fy === CURRENT_FY;
          const fyTotal = keys.reduce((s, k) => s + (counts[k] ?? 0), 0);
          return (
            <div
              key={fy}
              className="flex flex-wrap items-center gap-3 px-3 py-2.5"
            >
              <button
                type="button"
                onClick={() => toggleFy(fy)}
                title={
                  allSelected
                    ? `Deselect all FY${String(fy).slice(2)}`
                    : `Select all FY${String(fy).slice(2)}`
                }
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.05em] transition",
                  allSelected
                    ? "bg-brand-600 text-white ring-1 ring-brand-700 hover:bg-brand-700"
                    : someSelected
                      ? "bg-brand-100 text-brand-700 ring-1 ring-brand-200 hover:bg-brand-200"
                      : "bg-gray-100 text-ink-muted ring-1 ring-line hover:bg-gray-200",
                )}
              >
                FY{String(fy).slice(2)}
                {isCurrent ? (
                  <span
                    className={clsx(
                      "rounded-full px-1.5 py-0 text-[0.6rem] font-semibold",
                      allSelected
                        ? "bg-white/20 text-white"
                        : "bg-success/15 text-success",
                    )}
                  >
                    current
                  </span>
                ) : null}
              </button>

              <div className="flex flex-wrap items-center gap-1.5">
                {keys.map((key) => {
                  const isSelected = selectedSet.has(key);
                  const count = counts[key] ?? 0;
                  const disabled = count === 0;
                  const color = QUARTER_COLORS[key] ?? "#9CA3AF";
                  const qLabel = key.split(" ")[0];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleQuarter(key)}
                      disabled={disabled}
                      title={
                        disabled
                          ? `No opps in ${key}`
                          : isSelected
                            ? `Remove ${key}`
                            : `Add ${key}`
                      }
                      className={clsx(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-medium transition",
                        disabled
                          ? "cursor-not-allowed bg-gray-50 text-ink-subtle ring-1 ring-line/70"
                          : isSelected
                            ? "text-white shadow-sm"
                            : "bg-white text-ink-muted ring-1 ring-line hover:ring-brand-300",
                      )}
                      style={
                        isSelected && !disabled
                          ? { backgroundColor: color }
                          : undefined
                      }
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            isSelected && !disabled ? "#ffffff" : color,
                          opacity: disabled ? 0.4 : 1,
                        }}
                      />
                      {qLabel}
                      <span
                        className={clsx(
                          "text-[0.62rem] tabular-nums",
                          isSelected && !disabled
                            ? "text-white/75"
                            : "text-ink-subtle",
                        )}
                      >
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>

              <span className="ml-auto text-[0.7rem] tabular-nums text-ink-subtle">
                {selectedCount}/{keys.length} ·{" "}
                <span className="text-ink-muted">{fyTotal} opps</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
