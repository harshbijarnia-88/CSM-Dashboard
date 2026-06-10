"use client";

import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Row } from "@/lib/data/types";
import { fmtCurrency, fmtCurrencyFull } from "@/lib/format";
import {
  forecastCategoryFromRow,
  type ForecastCategory,
} from "@/lib/data/fetchExpansion";

// Same palette as ExpansionDonut so the category colors agree across the
// dashboard.
const CATEGORY_ORDER: ForecastCategory[] = [
  "Pipeline",
  "Most Likely",
  "Commit",
  "Closed Won",
  "Closed Lost",
  "Omitted",
];
const CATEGORY_COLORS: Record<ForecastCategory, string> = {
  Pipeline: "#1f77b4",
  "Most Likely": "#3a92d4",
  Commit: "#56b4e9",
  "Closed Won": "#059669",
  "Closed Lost": "#DC2626",
  Omitted: "#9ca3af",
};

type SortKey =
  | "Deal Name"
  | "effective_csm"
  | "Stage"
  | "forecast_category"
  | "Close Date (2)"
  | "Amount"
  | "Created Date";

type SortDir = "asc" | "desc";

const COLS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "Deal Name", label: "Deal Name" },
  { key: "effective_csm", label: "CSM" },
  { key: "Stage", label: "Stage" },
  { key: "forecast_category", label: "Forecast Category" },
  { key: "Close Date (2)", label: "Close Date" },
  { key: "Amount", label: "Amount", align: "right" },
  // "Last Activity" — temporarily reads from the Created Date column. When
  // the SF report exposes a real `LastActivityDate` column, swap this `key`
  // for `"LastActivityDate"` (and update RAW_NUMERIC_COLS / RENAME_MAP if a
  // rename is needed) — one-line change.
  { key: "Created Date", label: "Last Activity" },
];

function toAmount(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
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

export type ExpansionOpportunitiesTableProps = {
  rows: Row[];
  /** Multi-select forecast category filter shared with the donut above. When
   * empty, the table shows all expansion categories; otherwise it narrows. */
  selectedCategories?: Set<ForecastCategory>;
  onClearCategories?: () => void;
};

export function ExpansionOpportunitiesTable({
  rows,
  selectedCategories,
  onClearCategories,
}: ExpansionOpportunitiesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("Amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");
  // Section is collapsed by default. Auto-expands when the user clicks a
  // donut segment so the filtered opps surface immediately.
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    if ((selectedCategories?.size ?? 0) > 0) setCollapsed(false);
  }, [selectedCategories]);

  const expansionRows = useMemo(
    () => rows.filter((r) => String(r["Type"] ?? "").trim() === "Expansion"),
    [rows],
  );

  // Stamp each row with its computed forecast category so sort + render can
  // read it as a column.
  const stampedRows: Array<Row & { forecast_category: ForecastCategory }> =
    useMemo(
      () =>
        expansionRows.map((r) => ({
          ...r,
          forecast_category: forecastCategoryFromRow(r),
        })),
      [expansionRows],
    );

  const filteredRows = useMemo(() => {
    let pool = stampedRows;
    if (selectedCategories && selectedCategories.size > 0) {
      pool = pool.filter((r) => selectedCategories.has(r.forecast_category));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      // Search across the columns a user is most likely to type from:
      // deal name, account name, CSM, stage, and forecast category.
      pool = pool.filter((r) => {
        const hay = [
          r["Deal Name"],
          r["Account Name"],
          r["effective_csm"],
          r["Stage"],
          r.forecast_category,
        ]
          .map((v) => String(v ?? "").toLowerCase())
          .join(" ");
        return hay.includes(q);
      });
    }
    return pool;
  }, [stampedRows, selectedCategories, query]);

  const sorted = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let cmp: number;
      if (sortKey === "Amount") {
        cmp = toAmount(a[sortKey]) - toAmount(b[sortKey]);
      } else if (sortKey === "Close Date (2)" || sortKey === "Created Date") {
        const ta = new Date(String(a[sortKey] ?? "")).getTime();
        const tb = new Date(String(b[sortKey] ?? "")).getTime();
        cmp = (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
      } else {
        cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortKey, sortDir]);

  const totalAmount = useMemo(
    () => sorted.reduce((s, r) => s + toAmount(r["Amount"]), 0),
    [sorted],
  );

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(
        key === "Amount" ||
          key === "Close Date (2)" ||
          key === "Created Date"
          ? "desc"
          : "asc",
      );
    }
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span aria-hidden className="inline-block h-3 w-1 rounded-full bg-purple-500" />
        <div className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          Expansion Opportunities
        </div>
        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[0.68rem] font-medium text-purple-700 ring-1 ring-purple-200">
          {fmtCurrency(totalAmount)} amount
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-medium text-ink-muted">
          Type = Expansion only
        </span>
        {selectedCategories && selectedCategories.size > 0 ? (
          <button
            type="button"
            onClick={() => onClearCategories?.()}
            className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[0.65rem] font-medium text-purple-700 ring-1 ring-purple-200 hover:bg-purple-100"
            title="Clear donut filter"
          >
            From donut: {Array.from(selectedCategories).join(", ")}
            <span aria-hidden className="text-purple-500">×</span>
          </button>
        ) : null}
        <span aria-hidden className="ml-1 flex-1 border-b border-line" />
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Show expansion table" : "Hide expansion table"}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[0.7rem] font-medium text-ink-muted transition-colors hover:border-purple-300 hover:bg-purple-50/70 hover:text-purple-700"
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
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search deal, account, CSM, stage…"
                aria-label="Search expansion opportunities"
                className="w-full rounded-lg border border-line bg-white px-3 py-1.5 pr-8 text-[0.78rem] text-ink placeholder:text-ink-subtle focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200"
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
              {/* Subtotal row — sits directly above the column labels. The
                  Amount column is the only numeric one (Last Activity is a
                  date), so just that cell carries a value. */}
              <tr className="bg-purple-50/40">
                <td
                  colSpan={COLS.length - 2}
                  className="border-b border-line px-4 py-2 text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle"
                >
                  Subtotals →
                </td>
                <td className="border-b border-line px-4 py-2 text-right text-[0.78rem] font-semibold tabular-nums text-ink">
                  {fmtCurrencyFull(totalAmount)}
                </td>
                <td className="border-b border-line px-4 py-2" />
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
                    No expansion opportunities in the current selection.
                  </td>
                </tr>
              ) : (
                sorted.map((r, i) => {
                  const stage = String(r["Stage"] ?? "");
                  const cat = r.forecast_category as ForecastCategory;
                  const dealName = String(r["Deal Name"] ?? "");
                  const account = String(r["Account Name"] ?? "");
                  return (
                    <tr
                      key={`${dealName}-${i}`}
                      className="border-b border-line/70 last:border-b-0 hover:bg-purple-50/40"
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
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.7rem] font-medium text-white"
                          style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                        >
                          {cat}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-top tabular-nums text-ink-muted">
                        {fmtDate(r["Close Date (2)"])}
                      </td>
                      <td className="px-4 py-2.5 text-right align-top tabular-nums font-medium text-ink">
                        {fmtCurrencyFull(toAmount(r["Amount"]))}
                      </td>
                      <td className="px-4 py-2.5 align-top tabular-nums text-ink-muted">
                        {fmtDate(r["Created Date"])}
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
