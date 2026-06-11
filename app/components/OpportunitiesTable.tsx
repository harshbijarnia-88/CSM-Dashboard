"use client";

import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  /** Optional controlled multi-select renewal-status filter. When supplied
   * the table reads from this set instead of its internal state, and
   * delegates updates back via `onStatusFilterChange`. Used by the
   * GRR Gap / Book in Risk / Renewal Upgrade drilldowns to pre-populate
   * the filter from SectionA tile clicks. */
  statusFilter?: Set<string>;
  onStatusFilterChange?: (next: Set<string>) => void;
  /** Optional controlled multi-select Stage filter. Drilldowns (e.g.
   * % Book in Risk) use this to pre-populate the filter with only the
   * open SF stages so the table surfaces actionable opps. */
  stageFilter?: Set<string>;
  onStageFilterChange?: (next: Set<string>) => void;
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

export function OpportunitiesTable({
  rows,
  statusFilter: controlledStatusFilter,
  onStatusFilterChange,
  stageFilter: controlledStageFilter,
  onStageFilterChange,
}: OpportunitiesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("Amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");
  // Default = collapsed on initial load (every table + chart on the
  // dashboard starts hidden so the user picks what to look at). Auto-
  // expands when a drilldown sets a status filter, via the useEffect
  // below. User can collapse / re-expand via the chevron in the section
  // header at any time; filter state below is preserved while hidden.
  const [collapsed, setCollapsed] = useState(true);
  // Multi-select click-to-filter from the By Renewal Status panel.
  // Empty set = show all renewals. Uses controlled state when the parent
  // passes one (e.g. for the NRR Gap drilldown); otherwise keeps its own.
  const [internalStatusFilter, setInternalStatusFilter] = useState<Set<string>>(
    () => new Set(),
  );
  const statusFilter = controlledStatusFilter ?? internalStatusFilter;
  const setStatusFilter = (next: Set<string>) => {
    if (onStatusFilterChange) onStatusFilterChange(next);
    else setInternalStatusFilter(next);
  };
  const toggleStatus = (s: string) => {
    const next = new Set(statusFilter);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setStatusFilter(next);
  };
  // If the parent pushes a non-empty filter in (e.g. NRR Gap drilldown
  // sets three risk statuses), force-expand the table so the rows are
  // visible immediately.
  useEffect(() => {
    if (controlledStatusFilter && controlledStatusFilter.size > 0) {
      setCollapsed(false);
    }
  }, [controlledStatusFilter]);
  // Multi-select Stage filter (SF opportunity stage — different column from
  // Renewal Status). Composes via AND with the status filter and search.
  // Same controlled/uncontrolled pattern as statusFilter — the parent
  // can push a filter in (e.g. Book in Risk drilldown sets the open
  // stages) and we delegate updates back via onStageFilterChange.
  const [internalStageFilter, setInternalStageFilter] = useState<Set<string>>(
    () => new Set(),
  );
  const stageFilter = controlledStageFilter ?? internalStageFilter;
  const setStageFilter = (next: Set<string>) => {
    if (onStageFilterChange) onStageFilterChange(next);
    else setInternalStageFilter(next);
  };
  const [stageMenuOpen, setStageMenuOpen] = useState(false);
  useEffect(() => {
    if (controlledStageFilter && controlledStageFilter.size > 0) {
      setCollapsed(false);
    }
  }, [controlledStageFilter]);

  // Renewal Status is only meaningful for Renewal-type opps, so this panel is
  // narrowed to Type = "Renewals" throughout (summary, breakdown, table).
  const renewalRows = useMemo(
    () => rows.filter((r) => String(r["Type"] ?? "").trim() === "Renewals"),
    [rows],
  );


  // Canonical SF renewal-stage picklist, in pipeline order. Hard-coded
  // (not computed from data) so the dropdown is stable as the team
  // transitions stage labels in SF. Closed Won + Closed Lost are split
  // because they're meaningfully different filters for a CSM.
  const availableStages = useMemo(
    () => [
      "Renewal Anticipation",
      "Proposal Discussion",
      "Renewal Confirmation",
      "Closed Won",
      "Closed Lost",
    ],
    [],
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
    if (stageFilter.size > 0) {
      pool = pool.filter((r) =>
        stageFilter.has(String(r["Stage"] ?? "").trim()),
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
  }, [renewalRows, statusFilter, stageFilter, query]);

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

            {/* Stage filter — independent of the Renewal Status cards above.
                Stage = SF opportunity stage; Renewal Status = CSM's
                qualitative read. Both filters compose via AND. */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setStageMenuOpen((o) => !o)}
                aria-expanded={stageMenuOpen}
                aria-haspopup="menu"
                className={
                  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[0.75rem] font-medium transition-colors " +
                  (stageFilter.size > 0
                    ? "border-brand-300 bg-brand-50 text-brand-700"
                    : "border-line bg-white text-ink-muted hover:border-brand-200 hover:bg-brand-50/40")
                }
              >
                <span>Stage</span>
                {stageFilter.size > 0 ? (
                  <span className="rounded-full bg-brand-200 px-1.5 text-[0.65rem] font-semibold text-brand-800">
                    {stageFilter.size}
                  </span>
                ) : null}
                <span aria-hidden className="text-ink-subtle">
                  {stageMenuOpen ? "▲" : "▼"}
                </span>
              </button>
              {stageMenuOpen ? (
                <>
                  <div
                    aria-hidden
                    onClick={() => setStageMenuOpen(false)}
                    className="fixed inset-0 z-10"
                  />
                  <div
                    role="menu"
                    className="absolute left-0 z-20 mt-1 w-60 overflow-hidden rounded-lg border border-line bg-white shadow-lg"
                  >
                    <div className="flex items-center justify-between border-b border-line bg-gray-50 px-3 py-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                      <span>Filter by Stage</span>
                      {stageFilter.size > 0 ? (
                        <button
                          type="button"
                          onClick={() => setStageFilter(new Set())}
                          className="rounded px-1 text-[0.66rem] font-medium text-brand-700 hover:bg-brand-50"
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                    <div className="max-h-60 overflow-auto py-1">
                      {availableStages.length === 0 ? (
                        <div className="px-3 py-2 text-[0.74rem] text-ink-subtle">
                          No stages in current data
                        </div>
                      ) : (
                        availableStages.map((s) => {
                          const checked = stageFilter.has(s);
                          return (
                            <label
                              key={s}
                              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[0.78rem] text-ink hover:bg-brand-50/60"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = new Set(stageFilter);
                                  if (next.has(s)) next.delete(s);
                                  else next.add(s);
                                  setStageFilter(next);
                                }}
                                className="h-3.5 w-3.5 accent-brand-600"
                              />
                              <span className="truncate">{s}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
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
