"use client";

import { useEffect, useState } from "react";
import { fmtCurrency } from "@/lib/format";

export type HeaderProps = {
  fetchedAt: string;
  totalProjectedNrr: number;
  rowCount: number;
};

function relTime(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return "1 hour ago";
  return `${hrs} hours ago`;
}

export function Header({ fetchedAt, totalProjectedNrr, rowCount }: HeaderProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-line bg-white/70 p-6 shadow-card backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full bg-brand-500 shadow-[0_0_0_4px_rgba(123,79,231,0.18)]"
          />
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brand-600">
            Zuddl · Customer Success
          </span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-[1.65rem] font-w650 leading-tight text-ink">
            CSM Book of Business
          </h1>
        </div>
        <div className="text-[0.78rem] text-ink-muted">
          Retention & Expansion · Targets: GRR 95% · NRR 110%
          <span className="ml-2 text-ink-subtle">· Updated {relTime(fetchedAt, now)}</span>
        </div>
      </div>
      <div className="rounded-xl border border-brand-200/70 bg-gradient-to-br from-brand-500 to-brand-700 px-5 py-4 text-white shadow-[0_8px_24px_-12px_rgba(80,37,176,0.55)]">
        <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-brand-100/80">
          Total Projected NRR
        </div>
        <div className="mt-1 text-[2rem] font-w650 leading-none">
          {fmtCurrency(totalProjectedNrr)}
        </div>
        <div className="mt-1 text-[0.72rem] text-brand-100/80">
          {rowCount.toLocaleString()} opp{rowCount === 1 ? "" : "s"} in selection
        </div>
      </div>
    </header>
  );
}
