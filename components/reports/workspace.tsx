// Shared content+rail shell used by every report page.
// Middle column scrolls; right rail is sticky and narrow.
import * as React from 'react';

export function Workspace({
  header,
  children,
  rail,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  rail?: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      {/* MIDDLE */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-ink-100 bg-white px-8 py-5">
          {header}
        </div>
        <div className="flex-1 overflow-y-auto bg-cream-50 px-8 py-6">
          {children}
        </div>
      </div>

      {/* RIGHT RAIL */}
      {rail && (
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-ink-100 bg-white px-6 py-6">
          {rail}
        </aside>
      )}
    </div>
  );
}

export function WorkspaceHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-500">{eyebrow}</div>}
        <h1 className="truncate text-xl font-semibold text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// Section block within the scrolling content area. Tighter than <Card> — feels more like a dense report.
export function Section({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={'mb-6 overflow-hidden rounded-lg border border-ink-100 bg-white ' + (className ?? '')}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
}

// Compact KPI tile, row-aligned. Works inside a grid row or on its own.
export function Tile({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'neutral' | 'danger' | 'warning' | 'positive';
}) {
  const toneClasses: Record<string, string> = {
    neutral:  'text-ink-900',
    danger:   'text-bordeaux-700',
    warning:  'text-champagne-700',
    positive: 'text-green-700',
  };
  return (
    <div className="rounded-md border border-ink-100 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink-500">{label}</div>
      <div className={'mt-1 text-xl font-semibold tabular-nums ' + toneClasses[tone]}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-500">{sub}</div>}
    </div>
  );
}
