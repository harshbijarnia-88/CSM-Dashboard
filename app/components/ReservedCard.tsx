import clsx from "clsx";

export function ReservedCard({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-start justify-center rounded-[10px] border border-dashed border-line bg-white/40 p-4",
        className,
      )}
    >
      <div className="text-[0.72rem] font-medium uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </div>
      <div className="mt-2 text-sm text-ink-subtle">Coming soon</div>
    </div>
  );
}
