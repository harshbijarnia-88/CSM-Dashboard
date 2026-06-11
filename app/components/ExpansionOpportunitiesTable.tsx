"use client";

import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Row } from "@/lib/data/types";
import { fmtCurrency, fmtCurrencyFull } from "@/lib/format";
import {
  forecastCategoryFromRow,
  type ForecastCategory,
} from "@/lib/data/fetchExpansion";
import {
  fetchOppActivity,
  type OppActivityRollup,
} from "@/lib/data/fetchOppActivity";

// Same palette as ExpansionDonut so the category colors agree across the
// dashboard.
const CATEGORY_ORDER: ForecastCategory[] = [
  "Pipeline",
  "Best Case",
  "Most Likely",
  "Commit",
  "Closed Won",
  "Closed Lost",
  "Omitted",
];
const CATEGORY_COLORS: Record<ForecastCategory, string> = {
  Pipeline: "#1f77b4",
  "Best Case": "#0EA5E9",
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
  | "Last Activity";

type SortDir = "asc" | "desc";

const COLS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "Deal Name", label: "Deal Name" },
  { key: "effective_csm", label: "CSM" },
  { key: "Stage", label: "Stage" },
  { key: "forecast_category", label: "Forecast Category" },
  { key: "Close Date (2)", label: "Close Date" },
  { key: "Amount", label: "Amount", align: "right" },
  { key: "Last Activity", label: "Last Activity" },
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
  /** Toggle handler — lets the table's category filter button add/remove
   * categories from the same state the donut drives. */
  onToggleCategory?: (cat: ForecastCategory) => void;
};

export function ExpansionOpportunitiesTable({
  rows,
  selectedCategories,
  onClearCategories,
  onToggleCategory,
}: ExpansionOpportunitiesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("Amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  // Per-opp activity rollups fetched from the revenue-os endpoint. Empty
  // when the API is unreachable (e.g. revenue-os isn't running on the
  // public Vercel deploy) — in that case the table degrades to the
  // sheet's `Last Activity` column without breaking.
  const [activity, setActivity] = useState<Record<string, OppActivityRollup>>(
    {},
  );
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

  // Hydrate activity for every expansion opp visible in the parent's filter
  // window. One batched request per change in the underlying ID set; the
  // result is keyed by Opportunity ID for O(1) lookup at render time.
  useEffect(() => {
    const ids = Array.from(
      new Set(
        expansionRows
          .map((r) => String(r["Opportunity ID"] ?? "").trim())
          .filter(Boolean),
      ),
    );
    if (ids.length === 0) {
      setActivity({});
      return;
    }
    let cancelled = false;
    fetchOppActivity(ids).then((map) => {
      if (!cancelled) setActivity(map);
    });
    return () => {
      cancelled = true;
    };
  }, [expansionRows]);

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

  // Forecast categories present in the data — drives the dropdown options.
  const availableCategories = useMemo(() => {
    const set = new Set<ForecastCategory>();
    for (const r of stampedRows) set.add(r.forecast_category);
    // Canonical order matching the donut so the dropdown matches its legend.
    const canonical: ForecastCategory[] = [
      "Pipeline",
      "Best Case",
      "Most Likely",
      "Commit",
      "Closed Won",
      "Closed Lost",
      "Omitted",
    ];
    return canonical.filter((c) => set.has(c));
  }, [stampedRows]);

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
      } else if (sortKey === "Close Date (2)" || sortKey === "Last Activity") {
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
          key === "Last Activity"
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

            {/* Forecast Category filter — same selection state as the donut.
                Pick a category here OR click a slice; both update the same
                `selectedCategories` set. */}
            {onToggleCategory ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCategoryMenuOpen((o) => !o)}
                  aria-expanded={categoryMenuOpen}
                  aria-haspopup="menu"
                  className={
                    "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[0.75rem] font-medium transition-colors " +
                    ((selectedCategories?.size ?? 0) > 0
                      ? "border-purple-300 bg-purple-50 text-purple-700"
                      : "border-line bg-white text-ink-muted hover:border-purple-200 hover:bg-purple-50/40")
                  }
                >
                  <span>Forecast Category</span>
                  {(selectedCategories?.size ?? 0) > 0 ? (
                    <span className="rounded-full bg-purple-200 px-1.5 text-[0.65rem] font-semibold text-purple-800">
                      {selectedCategories!.size}
                    </span>
                  ) : null}
                  <span aria-hidden className="text-ink-subtle">
                    {categoryMenuOpen ? "▲" : "▼"}
                  </span>
                </button>
                {categoryMenuOpen ? (
                  <>
                    <div
                      aria-hidden
                      onClick={() => setCategoryMenuOpen(false)}
                      className="fixed inset-0 z-10"
                    />
                    <div
                      role="menu"
                      className="absolute left-0 z-20 mt-1 w-60 overflow-hidden rounded-lg border border-line bg-white shadow-lg"
                    >
                      <div className="flex items-center justify-between border-b border-line bg-gray-50 px-3 py-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                        <span>Filter by Forecast Category</span>
                        {(selectedCategories?.size ?? 0) > 0 && onClearCategories ? (
                          <button
                            type="button"
                            onClick={() => onClearCategories()}
                            className="rounded px-1 text-[0.66rem] font-medium text-purple-700 hover:bg-purple-50"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                      <div className="max-h-60 overflow-auto py-1">
                        {availableCategories.length === 0 ? (
                          <div className="px-3 py-2 text-[0.74rem] text-ink-subtle">
                            No categories in current data
                          </div>
                        ) : (
                          availableCategories.map((c) => {
                            const checked = selectedCategories?.has(c) ?? false;
                            return (
                              <label
                                key={c}
                                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[0.78rem] text-ink hover:bg-purple-50/60"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => onToggleCategory(c)}
                                  className="h-3.5 w-3.5 accent-purple-600"
                                />
                                <span className="truncate">{c}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}

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
                  const oppId = String(r["Opportunity ID"] ?? "").trim();
                  const rollup = activity[oppId];
                  const staleDays = daysSinceLastActivity(
                    rollup?.lastActivityAt,
                    String(r["Last Activity"] ?? "").trim(),
                  );
                  const isStale = staleDays === null || staleDays > 14;
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
                        {isStale ? (
                          <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[0.62rem] font-medium text-amber-800 ring-1 ring-amber-200/70">
                            <span aria-hidden>⚠</span>
                            <span>
                              {staleDays === null
                                ? "No activity on record"
                                : `Last activity ${staleDays}d ago · stale`}
                            </span>
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
                      <td className="px-4 py-2.5 align-top text-ink-muted">
                        <LastActivityCell
                          sheetDate={r["Last Activity"]}
                          rollup={
                            activity[String(r["Opportunity ID"] ?? "").trim()]
                          }
                        />
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

/**
 * Last Activity cell — prefers the Postgres-derived rollup when available,
 * falls back to the sheet's `Last Activity` column when the
 * `/api/csm/opp-activity` endpoint is unreachable (e.g. on the public Vercel
 * deploy when revenue-os isn't accessible). Renders a relative-time label
 * + an opp-level activity tooltip on hover.
 */
function LastActivityCell({
  sheetDate,
  rollup,
}: {
  sheetDate: unknown;
  rollup: OppActivityRollup | undefined;
}) {
  const pgDate = rollup?.lastActivityAt
    ? new Date(rollup.lastActivityAt)
    : null;
  const fallback = String(sheetDate ?? "").trim();
  const display = pgDate
    ? relTime(pgDate)
    : fallback
      ? fmtDate(fallback)
      : "—";
  // Show the tooltip whenever we have *something* to show — Postgres
  // rollup data, or even just the sheet's Last Activity date as context.
  // The previous "rollup with touches14d > 0" check hid the tooltip on
  // most rows, including ones that obviously show a date in the cell.
  const hasPgData =
    !!rollup &&
    (rollup.totalTouches14d > 0 ||
      !!rollup.lastActivityAt ||
      !!rollup.lastOutboundEmailAt ||
      !!rollup.lastInboundEmailAt);
  const hasSheetDate = !!fallback;
  const hasTooltip = hasPgData || hasSheetDate;

  // Tooltip is rendered into `document.body` via a React Portal so it
  // escapes the table's `overflow-auto` scroll container (which clips
  // `position: absolute` children). Coords use `pageX/pageY` (= clientX +
  // window.scrollX) so they work both inside the auto-sized iframe used
  // by the revenue-os shell and on the standalone deploy where the page
  // scrolls normally.
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  // Portal targets `document.body`; we resolve it after mount because SSR
  // doesn't have a body and we want to avoid `useLayoutEffect` warnings.
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document !== "undefined") setPortalEl(document.body);
  }, []);
  const TOOLTIP_WIDTH = 264;

  function positionFromEvent(e: { pageX: number; pageY: number }) {
    const margin = 8;
    const viewportRight =
      (typeof window !== "undefined" ? window.scrollX + window.innerWidth : 0) -
      margin;
    const left = Math.min(viewportRight - TOOLTIP_WIDTH, e.pageX + 12);
    const top = e.pageY + 16;
    setCoords({ top, left });
  }
  function showTooltip(e: React.MouseEvent | React.FocusEvent) {
    if ("pageX" in e) positionFromEvent(e);
    setOpen(true);
  }
  function hideTooltip() {
    setOpen(false);
  }

  return (
    <>
      <span
        onMouseEnter={hasTooltip ? showTooltip : undefined}
        onMouseMove={hasTooltip && open ? positionFromEvent : undefined}
        onMouseLeave={hasTooltip ? hideTooltip : undefined}
        onFocus={hasTooltip ? showTooltip : undefined}
        onBlur={hasTooltip ? hideTooltip : undefined}
        tabIndex={hasTooltip ? 0 : -1}
        className={clsx(
          "inline-block tabular-nums",
          hasTooltip
            ? "cursor-help underline decoration-dotted underline-offset-2"
            : "",
        )}
      >
        {display}
      </span>
      {open && hasTooltip && coords && portalEl
        ? createPortal(
        <div
          role="tooltip"
          className="pointer-events-none absolute z-[100] w-64 rounded-lg border border-line bg-white p-3 text-left shadow-lg"
          style={{ top: coords.top, left: coords.left }}
        >
          {rollup && rollup.totalTouches14d > 0 ? (
            <>
              <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                Activity · last 14 days
              </div>
              <div className="mt-2 space-y-1 text-[0.74rem] text-ink-muted">
                <TouchRow
                  label="Outbound emails"
                  value={rollup.outboundEmails14d}
                />
                <TouchRow
                  label="Inbound emails"
                  value={rollup.inboundEmails14d}
                />
                <TouchRow label="Calls" value={rollup.calls14d} />
                <TouchRow label="Meetings (held)" value={rollup.meetings14d} />
                {rollup.canceledOrNoShowMeetings14d > 0 ? (
                  <TouchRow
                    label="Canceled / no-show"
                    value={rollup.canceledOrNoShowMeetings14d}
                    tone="danger"
                  />
                ) : null}
                {rollup.linkedin14d > 0 ? (
                  <TouchRow label="LinkedIn" value={rollup.linkedin14d} />
                ) : null}
                {rollup.engageSteps14d > 0 ? (
                  <TouchRow
                    label="Engage steps"
                    value={rollup.engageSteps14d}
                  />
                ) : null}
                <TouchRow label="Other tasks" value={rollup.otherTasks14d} />
              </div>
            </>
          ) : (
            <div className="text-[0.66rem] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
              No activity in last 14 days
            </div>
          )}
          {rollup &&
          (rollup.lastActivityAt ||
            rollup.lastOutboundEmailAt ||
            rollup.lastInboundEmailAt) ? (
            <div
              className={clsx(
                "border-line/70 text-[0.66rem] text-ink-subtle",
                rollup.totalTouches14d > 0
                  ? "mt-2 border-t pt-2"
                  : "mt-2 space-y-0.5",
              )}
            >
              {rollup.lastActivityAt ? (
                <div>
                  Last activity:{" "}
                  <span className="text-ink-muted">
                    {fmtDate(rollup.lastActivityAt)}
                  </span>
                </div>
              ) : null}
              {rollup.lastOutboundEmailAt ? (
                <div>
                  Last outbound:{" "}
                  <span className="text-ink-muted">
                    {fmtDate(rollup.lastOutboundEmailAt)}
                  </span>
                </div>
              ) : null}
              {rollup.lastInboundEmailAt ? (
                <div>
                  Last inbound:{" "}
                  <span className="text-ink-muted">
                    {fmtDate(rollup.lastInboundEmailAt)}
                  </span>
                </div>
              ) : null}
              {rollup.lastMeetingAt ? (
                <div>
                  Last meeting:{" "}
                  <span className="text-ink-muted">
                    {fmtDate(rollup.lastMeetingAt)}
                  </span>
                </div>
              ) : null}
              {rollup.lastCanceledMeetingAt ? (
                <div>
                  Last cancellation:{" "}
                  <span className="text-danger">
                    {fmtDate(rollup.lastCanceledMeetingAt)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : !hasPgData && hasSheetDate ? (
            <div className="mt-2 text-[0.66rem] text-ink-subtle">
              From SF{" "}
              <span className="text-ink-muted">LastActivityDate</span> ·{" "}
              {fmtDate(fallback)}
              <div className="mt-1 italic text-ink-subtle/80">
                No granular touchpoint data synced yet for this opp.
              </div>
            </div>
          ) : null}
        </div>,
            portalEl,
          )
        : null}
    </>
  );
}

function TouchRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={tone === "danger" ? "text-danger" : ""}>{label}</span>
      <span
        className={clsx(
          "font-medium",
          tone === "danger" ? "text-danger" : "text-ink",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Compact relative-time formatter — "3d ago", "5w ago" — for the inline
 * cell value. Falls back to an absolute date for anything older than a
 * year so the meaning stays clear.
 */
function relTime(d: Date): string {
  const ms = Date.now() - d.getTime();
  if (!Number.isFinite(ms) || ms < 0) return fmtDate(d.toISOString());
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return fmtDate(d.toISOString());
}

/**
 * Days since the most recent activity for an opp, preferring the
 * Postgres rollup's `lastActivityAt` and falling back to the sheet's
 * `Last Activity` column when Postgres has nothing. Returns `null` when
 * neither source has a usable date — caller treats that as "stale".
 */
function daysSinceLastActivity(
  pgIso: string | null | undefined,
  sheetDate: string,
): number | null {
  const raw =
    pgIso ??
    (sheetDate
      ? new Date(sheetDate).toISOString().replace("Invalid Date", "")
      : null);
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return null;
  const days = Math.floor((Date.now() - t) / 86_400_000);
  return days < 0 ? 0 : days;
}
