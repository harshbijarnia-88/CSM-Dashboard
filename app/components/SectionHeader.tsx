export function SectionHeader({
  children,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  subtitle?: string;
  /** Optional control rendered at the far right of the header (e.g. collapse toggle). */
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end gap-3">
      <span
        aria-hidden
        className="mb-1 inline-block h-3.5 w-1 rounded-full bg-brand-500"
      />
      <div className="flex flex-col">
        <div className="text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-ink">
          {children}
        </div>
        {subtitle ? (
          <div className="mt-0.5 text-[0.72rem] text-ink-subtle">{subtitle}</div>
        ) : null}
      </div>
      <span aria-hidden className="mb-1 flex-1 border-b border-line/80" />
      {action ? <div className="mb-0.5">{action}</div> : null}
    </div>
  );
}
