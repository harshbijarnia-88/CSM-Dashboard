"use client";

import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";

export function ChartCollapseToggle({
  collapsed,
  onToggle,
  label,
}: {
  collapsed: boolean;
  onToggle: () => void;
  /** Aria label, defaults to a generic Show/Hide charts. */
  label?: string;
}) {
  const accessible = label ?? (collapsed ? "Show charts" : "Hide charts");
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={accessible}
      aria-expanded={!collapsed}
      title={accessible}
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[0.7rem] font-medium text-ink-muted transition-colors",
        "hover:border-brand-300 hover:bg-brand-50/70 hover:text-brand-700",
      )}
    >
      {collapsed ? (
        <>
          <ChevronDown className="h-3 w-3" />
          <span>Show charts</span>
        </>
      ) : (
        <>
          <ChevronUp className="h-3 w-3" />
          <span>Hide charts</span>
        </>
      )}
    </button>
  );
}
