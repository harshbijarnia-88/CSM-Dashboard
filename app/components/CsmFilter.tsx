"use client";

import clsx from "clsx";
import { ALL_CSM, CSM_LIST } from "@/lib/constants";

const CSM_COLORS: Record<string, string> = {
  "Aastha Jindal": "#7B4FE7",
  "Janhvi Gupta": "#10B981",
  "Joe Huisman": "#1f77b4",
  "Saumitra Shekhar": "#D97706",
  "Saurabh Singh": "#DB2777",
};

export type CsmFilterProps = {
  selected: string[];
  onChange: (next: string[]) => void;
  counts: Record<string, number>;
  totalOppCount: number;
};

export function CsmFilter({
  selected,
  onChange,
  counts,
  totalOppCount,
}: CsmFilterProps) {
  const selectedSet = new Set(selected);
  const allActive = selectedSet.has(ALL_CSM) || selectedSet.size === 0;

  function toggleAll() {
    onChange([ALL_CSM]);
  }

  function toggleCsm(name: string) {
    const next = new Set(selectedSet);
    next.delete(ALL_CSM);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    if (next.size === 0) {
      onChange([ALL_CSM]);
    } else {
      onChange(Array.from(next));
    }
  }

  const specificCount = selectedSet.has(ALL_CSM)
    ? 0
    : Array.from(selectedSet).length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-ink-muted">
          CSM Owner
        </label>
        {!allActive ? (
          <button
            type="button"
            onClick={toggleAll}
            className="text-[0.68rem] font-medium text-brand-600 hover:text-brand-700"
          >
            Reset to All
          </button>
        ) : null}
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-white p-2.5 shadow-card">
        {/* "All" sentinel chip */}
        <button
          type="button"
          onClick={toggleAll}
          title="Include every opportunity (all owners, even non-CSM)"
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.05em] transition",
            allActive
              ? "bg-brand-600 text-white ring-1 ring-brand-700 hover:bg-brand-700"
              : "bg-gray-100 text-ink-muted ring-1 ring-line hover:bg-gray-200",
          )}
        >
          All
          <span
            className={clsx(
              "text-[0.62rem] tabular-nums",
              allActive ? "text-white/75" : "text-ink-subtle",
            )}
          >
            ({totalOppCount})
          </span>
        </button>

        <span aria-hidden className="mx-1 h-5 w-px bg-line" />

        {CSM_LIST.map((name) => {
          const isSelected = selectedSet.has(name) && !selectedSet.has(ALL_CSM);
          const color = CSM_COLORS[name] ?? "#7B4FE7";
          const count = counts[name] ?? 0;
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggleCsm(name)}
              title={
                isSelected
                  ? `Remove ${name}`
                  : `Filter to ${name}${
                      selectedSet.size > 0 && !selectedSet.has(ALL_CSM)
                        ? " (add)"
                        : ""
                    }`
              }
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-medium transition",
                isSelected
                  ? "text-white shadow-sm"
                  : "bg-white text-ink-muted ring-1 ring-line hover:ring-brand-300",
              )}
              style={isSelected ? { backgroundColor: color } : undefined}
            >
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: isSelected ? "#ffffff" : color }}
              />
              {name}
              <span
                className={clsx(
                  "text-[0.62rem] tabular-nums",
                  isSelected ? "text-white/75" : "text-ink-subtle",
                )}
              >
                ({count})
              </span>
            </button>
          );
        })}

        <span className="ml-auto text-[0.7rem] tabular-nums text-ink-subtle">
          {allActive ? "All owners" : `${specificCount} selected`}
        </span>
      </div>
    </div>
  );
}
