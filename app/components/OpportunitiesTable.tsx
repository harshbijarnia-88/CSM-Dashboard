"use client";

import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import type { Row } from "@/lib/data/types";
import { fmtCurrency, fmtCurrencyFull } from "@/lib/format";
import { OthersBreakdown } from "./OthersBreakdown";

type SortKey =
  | "Deal Name"
  | "effective_csm"
  | "Type"
  | "Stage"
  | "Renewal Status"
  | "Close Date (2)"
  | "Upgrade/Downgrade Amount"
  | "Amount"
  | "Prior Contract Value";

type SortDir = "asc" | "desc";

export type OpportunitiesTableProps = {
  rows: Row[];
};

const COLS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "Deal Name", label: "Deal Name" },
  { key: "effective_csm", label: "CSM" },
  { key: "Type", label: "Type" },
  { key: "Stage", label: "Stage" },
  { key: "Renewal Status", label: "Renewal Stage" },
  { key: "Close Date (2)", label: "Close Date" },
  {
    key: "Upgrade/Downgrade Amount",
    label: "Upgrade / Downgrade",
    align: "right",
  },
  { key: "Amount", label: "Amount", align: "right" },
  { key: "Prior Contract Value", label: "Prior CV", align: "right" },
];

function stageTone(s: string): string {
  const v = s.toLowerCase();
  if (v.includes("closed won")) return "bg-success/10 text-success ring-success/20";
  if (v.includes("closed lost") || v.includes("churn"))
    return "bg-danger/10 text-danger ring-danger/20";
  if (v.includes("risk")) return "bg-amber-50 text-amber-700 ring-amber-200";
  if (v.includes("commit") || v.includes("strong"))
    return "bg-brand-50 text-brand-700 ring-brand-200";
  return "bg-gray-100 text-ink-muted ring-gray-200";
}

function fmtDate(v: unknown): string {
  if (v == null) return "—";
  const s = String(v).trim();
  if (!s) return "—";
  // Try ISO first, then return raw if unparseable.
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toAmount(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function compare(a: Row, b: Row, key: SortKey, dir: SortDir): number {
  const va = a[key];
  const vb = b[key];
  let cmp: number;
  if (
    key === "Upgrade/Downgrade Amount" ||
    key === "Amount" ||
    key === "Prior Contract Value"
  ) {
    cmp = toAmount(va) - toAmount(vb);
  } else if (key === "Close Date (2)") {
    const ta = new Date(String(va ?? "")).getTime();
    const tb = new Date(String(vb ?? "")).getTime();
    cmp = (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
  } else {
    cmp = String(va ?? "").localeCompare(String(vb ?? ""));
  }
  return dir === "asc" ? cmp : -cmp;
}

export function OpportunitiesTable({ rows }: OpportunitiesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("Amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");
  // Default = expanded (primary table). User can collapse via the chevron
  // in the section header; filter state below is preserved while hidden.
  const [collapsed, setCollapsed] = useState(false);
  // Multi-select click-to-filter from the By Renewal Status panel.
  // Empty set = show all renewals.
  const [statusFilter, setStatusFilter] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleStatus = (s: string) => {
    setStatusFilter((curr) => {
      const next = new Set(curr);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  // Renewal Status is only meaningful for Renewal-type opps, so this panel is
  // narrowed to Type = "Renewals" throughout (summary, breakdown, table).
  const renewalRows = useMemo(
    () => rows.filter((r) => String(r["Type"] ?? "").trim() === "Renewals"),
    [rows],
  );

  const tableRows = useMemo(() => {
    let pool = renewalRows;
    if (statusFilter.size > 0) {
      pool = pool.filter((r) =>
        statusFilter.has(
          String(r["Renewal Status"] ?? "").trim() || "Unspecified",
        ),
      );
    }
    const q = query.trim().toLowerCase();
    if (q) {
      // Substring search over the fields a user is likely to type from.
      pool = pool.filter((r) => {
        const hay = [
          r["Deal Name"],
          r["Account Name"],
          r["effective_csm"],
          r["Stage"],
          r["Renewal Status"],
        ]
          .map((v) => String(v ?? "").toLowerCase())
          .join(" ");
        return hay.includes(q);
      });
    }
    return pool;
  }, [renewalRows, statusFilter, query]);

  const sorted = useMemo(() => {
    return [...tableRows].sort((a, b) => compare(a, b, sortKey, sortDir));
  }, [tableRows, sortKey, sortDir]);

  const totalAmount = useMemo(
    () => sorted.reduce((s, r) => s + toAmount(r["Amount"]), 0),
    [sorted],
  );
  const totalUpgradeDowngrade = useMemo(
    () =>
      sorted.reduce(
        (s, r) => s + toAmount(r["Upgrade/Downgrade Amount"]),
        0,
      ),
    [sorted],
  );
  const totalPriorCv = useMemo(
    () => sorted.reduce((s, r) => s + toAmount(r["Prior Contract Value"]), 0),
    [sorted],
  );

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(
        key === "Upgrade/Downgrade Amount" ||
          key === "Amount" ||
          key === "Prior Contract Value" ||
          key === "Close Date (2)"
          ? "desc"
          : "asc",
      );
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden className="inline-block h-3 w-1 rounded-full bg-brand-500" />
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Renewal Opportunities
        </div>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.68rem] font-medium text-brand-700 ring-1 ring-brand-200">
          {sorted.length.toLocaleString()} renewal{sorted.length === 1 ? "" : "s"}
          {" · "}
          {fmtCurrency(totalAmount)} amount
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-medium text-ink-muted">
          Type = Renewals only
        </span>
        {statusFilter.size > 0 ? (
          <button
            type="button"
            onClick={() => setStatusFilter(new Set())}
            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[0.65rem] font-medium text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
          >
            Filter: {statusFilter.size} status
            {statusFilter.size === 1 ? "" : "es"}
            <span aria-hidden className="text-brand-500">×</span>
          </button>
        ) : null}
        <span aria-hidden className="ml-1 flex-1 border-b border-line" />
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Show renewals table" : "Hide renewals table"}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[0.7rem] font-medium text-ink-muted transition-colors hover:border-brand-300 hover:bg-brand-50/70 hover:text-brand-700"
        >
          {collapsed ? (
            <>
              <ChevronDown className="h-3 w-3" />
              <span>Show table</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-3 w-3" />
              <span>Hide table</span>
            </>
          )}
        </button>
      </div>

      {collapsed ? null : (
        <>
          <OthersBreakdown
            rows={renewalRows}
            selectedStatuses={statusFilter}
            onSelectStatus={toggleStatus}
          />

          <div className="mb-3 flex items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search deal, account, CSM, stage…"
                aria-label="Search renewal opportunities"
                className="w-full rounded-lg border border-line bg-white px-3 py-1.5 pr-8 text-[0.78rem] text-ink placeholder:text-ink-subtle focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-200"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-subtle hover:bg-gray-100 hover:text-ink"
                >
                  ×
                </button>
              ) : null}
            </div>
            {query ? (
              <span className="text-[0.7rem] tabular-nums text-ink-subtle">
                {sorted.length.toLocaleString()} match
                {sorted.length === 1 ? "" : "es"}
              </span>
            ) : null}
          </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gradient-to-b from-gray-50 to-white">
              {/* Subtotal row — sits directly above the column labels so the
                  user can see column sums without scrolling. Sticky with the
                  rest of thead. */}
              <tr className="bg-brand-50/40">
                <td
                  colSpan={COLS.length - 3}
                  className="border-b border-line px-4 py-2 text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle"
                >
                  Subtotals →
                </td>
                <td className="border-b border-line px-4 py-2 text-right text-[0.78rem] font-semibold tabular-nums text-ink">
                  {fmtCurrencyFull(totalUpgradeDowngrade)}
                </td>
                <td className="border-b border-line px-4 py-2 text-right text-[0.78rem] font-semibold tabular-nums text-ink">
                  {fmtCurrencyFull(totalAmount)}
                </td>
                <td className="border-b border-line px-4 py-2 text-right text-[0.78rem] font-semibold tabular-nums text-ink">
                  {fmtCurrencyFull(totalPriorCv)}
                </td>
              </tr>
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
                    No opportunities in the current selection.
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
                      className="border-b border-line/70 last:border-b-0 hover:bg-brand-50/40"
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
                      <td className="px-4 py-2.5 align-top tabular-nums text-ink-muted">
                        {fmtDate(r["Close Date (2)"])}
                      </td>
                      <td className="px-4 py-2.5 text-right align-top tabular-nums text-ink-muted">
                        {fmtCurrencyFull(toAmount(r["Upgrade/Downgrade Amount"]))}
                      </td>
                      <td className="px-4 py-2.5 text-right align-top tabular-nums font-medium text-ink">
                        {fmtCurrencyFull(toAmount(r["Amount"]))}
                      </td>
                      <td className="px-4 py-2.5 text-right align-top tabular-nums text-ink-muted">
                        {fmtCurrencyFull(toAmount(r["Prior Contract Value"]))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
          </div>
        </>
      )}
    </section>
  );
}
