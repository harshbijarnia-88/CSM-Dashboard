"use client";

import { CsmFilter } from "./CsmFilter";
import { QuarterFilter } from "./QuarterFilter";

export type FiltersProps = {
  quarterCounts: Record<string, number>;
  quarterSel: string[];
  onQuarterChange: (next: string[]) => void;
  csmCounts: Record<string, number>;
  totalOppCount: number;
  csmSel: string[];
  onCsmChange: (next: string[]) => void;
};

export function Filters({
  quarterCounts,
  quarterSel,
  onQuarterChange,
  csmCounts,
  totalOppCount,
  csmSel,
  onCsmChange,
}: FiltersProps) {
  return (
    <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <QuarterFilter
          selected={quarterSel}
          onChange={onQuarterChange}
          counts={quarterCounts}
        />
      </div>
      <div className="lg:col-span-5">
        <CsmFilter
          selected={csmSel}
          onChange={onCsmChange}
          counts={csmCounts}
          totalOppCount={totalOppCount}
        />
      </div>
    </div>
  );
}
