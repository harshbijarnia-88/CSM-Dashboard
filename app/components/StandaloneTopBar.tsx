"use client";

// Self-contained sticky top bar for the standalone deploy
// (csm-dashboard-temp.vercel.app). Mirrors the StickyTopBar that the
// revenue-os shell injects above the iframe — same nav chips, same header
// card with the three summary tiles (Projected ARR / Renewal Base /
// Projected NRR). Hidden when the page is embedded in an iframe so the
// parent shell doesn't double-render it.

import { useEffect, useRef, useState } from "react";

type SectionInfo = { id: string; top: number };

function fmtCurrencyShort(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

function fmtCurrencyFull(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
}

function relTimeFrom(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return "1 hour ago";
  return `${hrs} hours ago`;
}

export type StandaloneTopBarProps = {
  projectedArr: number;
  renewalBase: number;
  rowCount: number;
  fetchedAt: string;
};

export function StandaloneTopBar({
  projectedArr,
  renewalBase,
  rowCount,
  fetchedAt,
}: StandaloneTopBarProps) {
  // Default to "assume embedded" so the bar doesn't flash on initial render
  // when iframed by revenue-os; flip to standalone after we confirm we're
  // the top window.
  const [standalone, setStandalone] = useState(false);
  const [sections, setSections] = useState<SectionInfo[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      setStandalone(window.self === window.top);
    } catch {
      // Cross-origin access throws — that means we're definitely embedded.
      setStandalone(false);
    }
  }, []);

  // Index every [data-section] marker in the document. Re-scan on resize so
  // section offsets stay accurate when the page reflows.
  useEffect(() => {
    if (!standalone) return;
    function scan() {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>("[data-section]"),
      );
      const list: SectionInfo[] = els.map((el) => ({
        id: String(el.dataset.section ?? ""),
        top: el.getBoundingClientRect().top + window.scrollY,
      }));
      setSections(list);
    }
    // Two passes: once on mount, once after a short delay so charts/iframes
    // have time to settle.
    scan();
    const t = window.setTimeout(scan, 400);
    window.addEventListener("resize", scan);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", scan);
    };
  }, [standalone]);

  // Highlight the section that's currently anchored to the top of the
  // viewport (with a small offset so the bar itself doesn't count).
  useEffect(() => {
    if (!standalone || sections.length === 0) return;
    function onScroll() {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const viewportTop = window.scrollY + 170;
        let active: string | null = null;
        for (const s of sections) {
          if (s.top <= viewportTop) active = s.id;
        }
        setCurrentId(active ?? sections[0].id);
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [standalone, sections]);

  if (!standalone) return null;

  function scrollToSection(idx: number) {
    const s = sections[idx];
    if (!s) return;
    window.scrollTo({ top: s.top - 170, behavior: "smooth" });
  }

  const projectedNrrPct =
    renewalBase > 0 ? (projectedArr / renewalBase) * 100 : null;
  const currentIdx = sections.findIndex((s) => s.id === currentId);
  const nextIdx = currentIdx + 1 < sections.length ? currentIdx + 1 : null;

  return (
    <div className="sticky top-0 z-30 -mx-6 mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-[0_4px_16px_-8px_rgba(15,22,53,0.08)] backdrop-blur">
      {/* Navigation strip */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200 px-3 py-1.5 text-[12px]">
        <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          Navigation Bar
        </span>
        <span aria-hidden className="h-3 w-px shrink-0 bg-gray-300" />
        {sections.map((s, i) => {
          const isCurrent = i === currentIdx;
          const isNext = i === nextIdx;
          return (
            <button
              key={s.id || i}
              type="button"
              onClick={() => scrollToSection(i)}
              className={
                isCurrent
                  ? "shrink-0 rounded-md bg-purple-100 px-2 py-1 font-semibold text-purple-700"
                  : isNext
                    ? "shrink-0 rounded-md px-2 py-1 text-ink-muted ring-1 ring-purple-200 hover:bg-purple-50"
                    : "shrink-0 rounded-md px-2 py-1 text-ink-subtle hover:bg-gray-50 hover:text-ink-muted"
              }
              title={
                isCurrent ? "Current section" : isNext ? "Up next" : "Jump to section"
              }
            >
              {s.id}
            </button>
          );
        })}
      </div>

      {/* Header card with three big tiles. */}
      <div className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full bg-purple-500 shadow-[0_0_0_4px_rgba(123,79,231,0.18)]"
            />
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-purple-600">
              Zuddl · Customer Success
            </span>
          </div>
          <h2 className="text-[1.65rem] font-bold leading-tight text-ink">
            CSM Book of Business
          </h2>
          <div className="text-[0.78rem] text-ink-subtle">
            Retention &amp; Expansion · Targets: GRR 95% · NRR 110%
            {fetchedAt ? (
              <span className="ml-2 text-ink-subtle/70">
                · Updated {relTimeFrom(fetchedAt)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-stretch gap-3 md:justify-end">
          <BigSummaryTile
            label="Projected ARR"
            value={fmtCurrencyShort(projectedArr)}
            caption={`${rowCount.toLocaleString()} opps in selection`}
            variant="primary"
            tooltip={fmtCurrencyFull(projectedArr)}
          />
          <BigSummaryTile
            label="Renewal Base"
            value={fmtCurrencyShort(renewalBase)}
            caption="Prior-period ARR · NRR_Base"
            variant="secondary"
            tooltip={fmtCurrencyFull(renewalBase)}
          />
          <BigSummaryTile
            label="Projected NRR"
            value={projectedNrrPct !== null ? `${projectedNrrPct.toFixed(1)}%` : "—"}
            caption="Projected ARR ÷ Renewal Base"
            variant="primary"
            tooltip={
              projectedNrrPct !== null
                ? `${fmtCurrencyFull(projectedArr)} ÷ ${fmtCurrencyFull(renewalBase)}`
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}

function BigSummaryTile({
  label,
  value,
  caption,
  variant,
  tooltip,
}: {
  label: string;
  value: string;
  caption: string;
  variant: "primary" | "secondary";
  tooltip?: string;
}) {
  const palette =
    variant === "primary"
      ? "bg-gradient-to-br from-purple-500 to-purple-700 text-white shadow-[0_8px_24px_-12px_rgba(80,37,176,0.55)]"
      : "bg-gradient-to-br from-purple-700 to-purple-900 text-white shadow-[0_8px_24px_-12px_rgba(80,37,176,0.55)]";
  return (
    <div
      className={
        "group relative flex w-44 flex-col rounded-xl border border-purple-200/70 px-5 py-5 " +
        palette
      }
    >
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/80">
        {label}
      </div>
      <div className="mt-1 text-[2rem] font-w650 leading-none">{value}</div>
      <div className="mt-1 text-[0.72rem] leading-snug text-white/80">
        {caption}
      </div>
      {tooltip ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute -top-2 left-1/2 z-30 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium tabular-nums text-white opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {tooltip}
          <span
            aria-hidden
            className="absolute left-1/2 top-full -mt-px h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-ink"
          />
        </span>
      ) : null}
    </div>
  );
}
