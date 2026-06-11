import clsx from "clsx";
import { MousePointerClick } from "lucide-react";
import { fmtCurrency, fmtCurrencyFull, fmtPct } from "@/lib/format";

export type StatCardTone =
  | "red-when-positive"
  | "red"
  | "green"
  | "neutral";

export type StatCardProps = {
  label: string;
  value: number;
  kind: "percent" | "currency";
  tone?: StatCardTone;
  subtitle?: string;
  /** Optional secondary value shown directly below the main value in a
   * smaller, muted style. Use for "the $ that backs this %" reads. */
  secondary?: string;
  /** Optional raw $ amount backing `secondary`. When provided, hover shows
   * the full-precision dollar value as a native tooltip. */
  secondaryRaw?: number;
  /** When set, the card becomes clickable — hover lifts the shadow and the
   * cursor changes to pointer. Use for cross-section drilldowns (e.g.
   * clicking the NRR Gap tile applies a downstream filter). */
  onClick?: () => void;
  /** Accessible label for the click action when `onClick` is wired. */
  onClickLabel?: string;
  className?: string;
  /**
   * When set, renders a small progress bar inside the card showing how close
   * the underlying metric is to its target.
   *   achieved = the *actual* metric value (e.g. 0.90 for 90% GRR)
   *   target   = the target value         (e.g. 0.95 for 95% GRR)
   *
   * Bar fills proportionally (green) up to `achieved/target`, grey shows the
   * remaining gap. Labels read out the *real* percentages, not the proportion
   * of target reached.
   */
  progress?: {
    achieved: number;
    target: number;
    /** Word used in the left-hand label, e.g. "forecasted" (default) or
     * "achieved". Defaults to "forecasted" to match the projected gap tiles. */
    verb?: string;
  };
};

function toneFor(value: number, tone: StatCardTone | undefined): string {
  if (!Number.isFinite(value)) return "text-ink";
  switch (tone) {
    case "red":
      return "text-danger";
    case "green":
      return "text-success";
    case "red-when-positive":
      return value > 0 ? "text-danger" : "text-success";
    default:
      return "text-ink";
  }
}

export function StatCard({
  label,
  value,
  kind,
  tone,
  subtitle,
  secondary,
  secondaryRaw,
  onClick,
  onClickLabel,
  className,
  progress,
}: StatCardProps) {
  const display =
    kind === "percent" ? fmtPct(value) : fmtCurrency(value);
  const color = toneFor(value, tone);

  // Left rail tint signals tone without shouting.
  const railClass =
    tone === "red" || (tone === "red-when-positive" && value > 0)
      ? "bg-danger/70"
      : tone === "green" ||
          (tone === "red-when-positive" && Number.isFinite(value) && value <= 0)
        ? "bg-success/70"
        : "bg-line";

  return (
    <div
      {...(onClick
        ? {
            role: "button" as const,
            tabIndex: 0,
            onClick,
            onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            },
            "aria-label": onClickLabel,
          }
        : {})}
      className={clsx(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,22,53,0.04)] transition hover:shadow-[0_4px_16px_-6px_rgba(15,22,53,0.08)]",
        subtitle && "justify-between",
        onClick
          ? // Clickable affordance: persistent brand-tinted border + a soft
            // brand-50 tint, lifted shadow on hover so the card feels
            // tappable at rest. The corner chip below carries the explicit
            // "click to filter" label.
            "cursor-pointer border-brand-200 bg-brand-50/30 ring-1 ring-brand-100 hover:-translate-y-[1px] hover:border-brand-400 hover:bg-brand-50/60 hover:ring-brand-200"
          : "border-line",
        className,
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full transition-opacity",
          railClass,
        )}
      />
      {onClick ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-brand-700 ring-1 ring-brand-200 transition-all group-hover:bg-brand-500 group-hover:text-white group-hover:ring-brand-500"
        >
          <MousePointerClick className="h-3 w-3" strokeWidth={2.25} />
        </span>
      ) : null}
      <div className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </div>
      <div
        className={clsx(
          "group/value relative inline-flex w-fit items-center text-[2rem] font-w650 leading-[1.05] tabular-nums tracking-tight",
          // With subtitle or secondary: keep a small gap after the label.
          // Without either: vertically center the value in the remaining space.
          subtitle || secondary ? "mt-2" : "my-auto",
          color,
        )}
      >
        {display}
        {kind === "currency" && Number.isFinite(value) ? (
          <ValueTooltip text={fmtCurrencyFull(value)} />
        ) : null}
      </div>
      {secondary ? (
        <div
          className={clsx(
            "group/secondary relative mt-0.5 inline-flex w-fit items-center text-[0.95rem] font-semibold leading-none tabular-nums",
            color,
          )}
        >
          {secondary}
          {typeof secondaryRaw === "number" && Number.isFinite(secondaryRaw) ? (
            <ValueTooltip text={fmtCurrencyFull(secondaryRaw)} parentGroup="secondary" />
          ) : null}
        </div>
      ) : null}
      {subtitle ? (
        <div className="mt-1 text-[0.7rem] leading-snug text-ink-subtle">
          {subtitle}
        </div>
      ) : null}
      {progress ? (
        <ProgressBar
          achieved={progress.achieved}
          target={progress.target}
          verb={progress.verb ?? "forecasted"}
        />
      ) : null}
    </div>
  );
}

function ProgressBar({
  achieved,
  target,
  verb,
}: {
  achieved: number;
  target: number;
  verb: string;
}) {
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 1;
  const safeAchieved = Number.isFinite(achieved) ? achieved : 0;
  // Visual fill, capped at 100%, scaled to the target.
  const fillPct = Math.max(0, Math.min(1, safeAchieved / safeTarget)) * 100;
  // Labels speak in the *actual* metric values, not the proportion of target.
  const fmt = (v: number) => (v * 100).toFixed(1).replace(/\.0$/, "");
  const achievedActual = fmt(Math.max(0, safeAchieved));
  const remainingActual = fmt(Math.max(0, safeTarget - safeAchieved));
  const targetActual = fmt(safeTarget);
  const overshoot = safeAchieved >= safeTarget;
  return (
    <div className="mt-2.5 flex flex-col gap-1">
      <div className="h-2 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-success transition-[width] duration-300"
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[0.62rem] tabular-nums text-ink-subtle">
        <span>
          <span className="text-success">{achievedActual}%</span> {verb}
        </span>
        <span>
          {overshoot ? (
            <>target reached · {targetActual}%</>
          ) : (
            <>
              <span className="text-ink-muted">{remainingActual}%</span>{" "}
              remaining to {targetActual}%
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/** Instant-feedback floating tooltip for currency tiles. Uses Tailwind's
 * named-group syntax so the main value and secondary value can hover
 * independently without one triggering the other. */
function ValueTooltip({
  text,
  parentGroup = "value",
}: {
  text: string;
  parentGroup?: "value" | "secondary";
}) {
  const visibility =
    parentGroup === "value"
      ? "opacity-0 group-hover/value:opacity-100 group-focus-within/value:opacity-100"
      : "opacity-0 group-hover/secondary:opacity-100 group-focus-within/secondary:opacity-100";
  return (
    <span
      role="tooltip"
      className={clsx(
        "pointer-events-none absolute -top-2 left-1/2 z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[0.7rem] font-medium tabular-nums text-white shadow-lg transition-opacity duration-100",
        visibility,
      )}
    >
      {text}
      <span
        aria-hidden
        className="absolute left-1/2 top-full -mt-px h-1.5 w-1.5 -translate-x-1/2 rotate-45 bg-ink"
      />
    </span>
  );
}
