"use client";

import clsx from "clsx";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type MultiSelectProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  /** Optional dot color per option (used by Quarter to mirror chart palette). */
  optionColors?: Record<string, string>;
};

export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder,
  className,
  optionColors,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  }

  const summary =
    selected.length === 0
      ? (placeholder ?? "All")
      : selected.length === options.length
        ? "All"
        : selected.length <= 2
          ? selected.join(", ")
          : `${selected.length} selected`;

  return (
    <div ref={ref} className={clsx("relative", className)}>
      <label className="mb-1 block text-[0.7rem] font-medium uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm shadow-card transition hover:border-brand-300 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200"
      >
        <span className="truncate text-ink">{summary}</span>
        <ChevronDown size={16} className="text-ink-muted" />
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 w-full min-w-[220px] overflow-hidden rounded-md border border-line bg-white shadow-lg">
          <ul className="max-h-72 overflow-y-auto py-1">
            {options.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <li key={opt}>
                  <button
                    type="button"
                    onClick={() => toggle(opt)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    <span
                      className={clsx(
                        "flex h-4 w-4 items-center justify-center rounded border transition",
                        checked
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-gray-300 bg-white",
                      )}
                    >
                      {checked ? <Check size={12} strokeWidth={3} /> : null}
                    </span>
                    {optionColors?.[opt] ? (
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: optionColors[opt] }}
                      />
                    ) : null}
                    <span className="text-ink">{opt}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
