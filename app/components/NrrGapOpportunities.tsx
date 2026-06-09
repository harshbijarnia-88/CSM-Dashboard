"use client";

import clsx from "clsx";
import { useMemo, useState } from "react";
import type { Row } from "@/lib/data/types";
import { fmtCurrency } from "@/lib/format";

// "NRR gap" deals = opps where the SF Projected NRR field is 0
// AND the deal hasn't been Closed Won yet. These are the renewals /
// expansions still on the table that haven't yet rolled into the NRR forecast
// — actionable list for closing the gap to 110%.

type SortKey =
  | "Deal Name"
  | "effective_csm"
  | "Type"
  | "Stage"
  | "Renewal Status"
  | "Opp_closed_date_quarter"
  | "Close Date (2)"
  | "Amount"
  | "Prior Contract Value";

type SortDir = "asc" | "desc";

const COLS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "Deal Name", label: "Deal" },
  { key: "effective_csm", label: "CSM" },
  { key: "Type", label: "Type" },
  { key: "Stage", label: "Stage" },
  { key: "Renewal Status", label: "Renewal Stage" },
  { key: "Opp_closed_date_quarter", label: "Quarter" },
  { key: "Close Date (2)", label: "Close Date" },
  { key: "Amount", label: "Amount", align: "right" },
  { key: "Prior Contract Value", label: "Prior CV", align: "right" },
];

function num(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function isClosedWon(stage: string): boolean {
  return stage.trim().toLowerCase().includes("closed won");
}

function stageTone(s: string): string {
  const v = s.toLowerCase();
  if (v.includes("closed won")) return "bg-success/10 text-success ring-success/20";
  if (v.includes("closed lost") || v.includes("dead") || v.includes("churn"))
    return "bg-danger/10 text-danger ring-danger/20";
  if (v.includes("risk")) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (v.includes("commit") || v.includes("contracting"))
    return "bg-brand-50 text-brand-700 ring-brand-200";
  return "bg-gray-100 text-ink-muted ring-gray-200";
}

function fmtDate(v: unknown): string {
  if (v == null) return "—";
  const s = String(v).trim();
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export type NrrGapOpportunitiesProps = {
  rows: Row[];
};

export function NrrGapOpportunities({ rows }: NrrGapOpportunitiesProps) {
  const [sortKey, setSortKey] = useState<SortKey>("Amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const gapRows = useMemo(() => {
    return rows.filter((r) => {
      const projectedNrr = num(r["To_include_in_NRR"]);
      const stage = String(r["Stage"] ?? "");
      return projectedNrr === 0 && !isClosedWon(stage);
    });
  }, [rows]);

  const sorted = useMemo(() => {
    return [...gapRows].sort((a, b) => {
      let cmp: number;
      if (sortKey === "Amount" || sortKey === "Prior Contract Value") {
        cmp = num(a[sortKey]) - num(b[sortKey]);
      } else if (sortKey === "Close Date (2)") {
        const ta = new Date(String(a[sortKey] ?? "")).getTime();
        const tb = new Date(String(b[sortKey] ?? "")).getTime();
        cmp = (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
      } else {
        cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [gapRows, sortKey, sortDir]);

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(
        key === "Amount" ||
          key === "Prior Contract Value" ||
          key === "Close Date (2)"
          ? "desc"
          : "asc",
      );
    }
  }

  const totalAmount = useMemo(
    () => sorted.reduce((s, r) => s + num(r["Amount"]), 0),
    [sorted],
  );
  const totalPriorCv = useMemo(
    () => sorted.reduce((s, r) => s + num(r["Prior Contract Value"]), 0),
    [sorted],
  );

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span aria-hidden className="inline-block h-3 w-1 rounded-full bg-danger" />
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Opportunities driving NRR gap
        </div>
        <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[0.68rem] font-medium text-danger ring-1 ring-danger/20">
          {sorted.length.toLocaleString()} opp{sorted.length === 1 ? "" : "s"}
          {" · "}
          {fmtCurrency(totalAmount)} amount · {fmtCurrency(totalPriorCv)} prior CV
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-medium text-ink-muted">
          Projected NRR = 0 and not Closed Won
        </span>
        <span aria-hidden className="ml-1 flex-1 border-b border-line" />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
        <div className="max-h-[420px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gradient-to-b from-gray-50 to-white">
              <tr>
                {COLS.map((c) => {
                  const active = sortKey === c.key;
                  return (
                    <th
                      key={c.key}
                      onClick={() => onSort(c.key)}
                      className={clsx(
                        "select-none border-b border-line px-4 py-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-ink-muted",
                        c.align === "right" ? "text-right" : "text-left",
                        "cursor-pointer hover:text-brand-700",
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {c.label}
                        {active ? (
                          <span className="text-brand-600">
                            {sortDir === "asc" ? "▲" : "▼"}
                          </span>
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLS.length}
                    className="px-4 py-10 text-center text-sm text-ink-subtle"
                  >
                    No opportunities driving an NRR gap in the current selection.
                  </td>
                </tr>
              ) : (
                sorted.map((r, i) => {
                  const stage = String(r["Stage"] ?? "");
                  const rstage = String(r["Renewal Status"] ?? "");
                  const type = String(r["Type"] ?? "");
                  const dealName = String(r["Deal Name"] ?? "");
                  const account = String(r["Account Name"] ?? "");
                  return (
                    <tr
                      key={`${dealName}-${i}`}
                      className="border-b border-line/70 last:border-b-0 hover:bg-danger/5"
                    >
                      <td className="px-4 py-2.5 align-top">
                        <div className="font-medium text-ink">{dealName || "—"}</div>
                        {account ? (
                          <div className="mt-0.5 text-[0.72rem] text-ink-subtle">
                            {account}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 align-top text-ink-muted">
                        {String(r["effective_csm"] ?? "") || "—"}
                      </td>
                      <td className="px-4 py-2.5 align-top text-ink-muted">
                        {type || "—"}
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        {stage ? (
                          <span
                            className={clsx(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset",
                              stageTone(stage),
                            )}
                          >
                            {stage}
                          </span>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        {rstage ? (
                          <span
                            className={clsx(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium ring-1 ring-inset",
                              stageTone(rstage),
                            )}
                          >
                            {rstage}
                          </span>
                        ) : (
                          <span className="text-ink-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 align-top text-ink-muted">
                        {String(r["Opp_closed_date_quarter"] ?? "—")}
                      </td>
                      <td className="px-4 py-2.5 align-top tabular-nums text-ink-muted">
                        {fmtDate(r["Close Date (2)"])}
                      </td>
                      <td className="px-4 py-2.5 text-right align-top tabular-nums font-medium text-ink">
                        {fmtCurrency(num(r["Amount"]))}
                      </td>
                      <td className="px-4 py-2.5 text-right align-top tabular-nums text-ink-muted">
                        {fmtCurrency(num(r["Prior Contract Value"]))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
