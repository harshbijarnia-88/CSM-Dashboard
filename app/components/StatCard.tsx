import clsx from "clsx";
import { fmtCurrency, fmtPct } from "@/lib/format";

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
      className={clsx(
        "group relative flex flex-col overflow-hidden rounded-xl border border-line bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,22,53,0.04)] transition hover:shadow-[0_4px_16px_-6px_rgba(15,22,53,0.08)]",
        subtitle && "justify-between",
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
      <div className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </div>
      <div
        className={clsx(
          "text-[2rem] font-w650 leading-[1.05] tabular-nums tracking-tight",
          // With subtitle: keep a small gap after the label.
          // Without: vertically center the value in the remaining card space.
          subtitle ? "mt-2" : "my-auto",
          color,
        )}
      >
        {display}
      </div>
      {subtitle ? (
        <div className="mt-1 text-[0.7rem] leading-snug text-ink-subtle">
          {subtitle}
        </div>
      ) : null}
      {progress ? (
        <ProgressBar
          achieved={progress.achieved}
          target={progress.target}
        />
      ) : null}
    </div>
  );
}

function ProgressBar({
  achieved,
  target,
}: {
  achieved: number;
  target: number;
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
          <span className="text-success">{achievedActual}%</span> achieved
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
