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
    <div className="min-h-full">
      <div className="shrink-0 border-b border-gray-200 bg-white px-8 py-5">
        {header}
      </div>
      <div className="bg-gray-50 px-4 py-6 sm:px-8">
        {rail ? (
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="min-w-0 flex-1">{children}</div>
            <aside className="w-full shrink-0 lg:w-80">
              <div className="rounded-lg border border-gray-200 bg-white p-5 lg:sticky lg:top-6">{rail}</div>
            </aside>
          </div>
        ) : (
          children
        )}
      </div>
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
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">{eyebrow}</div>}
        <h1 className="truncate text-xl font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
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
    <section className={'mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white ' + (className ?? '')}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-gray-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
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
    neutral:  'text-gray-900',
    danger:   'text-red-700',
    warning:  'text-amber-700',
    positive: 'text-green-700',
  };
  return (
    <div className="rounded-md border border-gray-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className={'mt-1 text-xl font-semibold tabular-nums ' + toneClasses[tone]}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}
