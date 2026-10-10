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
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-x-6 md:gap-y-4">
      <div className="min-w-0 md:flex-1 md:basis-[22rem]">
        {eyebrow && <div className="mb-1.5 text-[13px] font-medium text-gray-500">{eyebrow}</div>}
        <h1 className="break-words font-display text-[24px] font-bold leading-[1.15] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] leading-6 text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
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
    <section className={'mb-6 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ' + (className ?? '')}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] leading-5 text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
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
    <div className="rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="text-[13px] font-medium text-gray-500">{label}</div>
      <div className={'mt-1 font-display text-[24px] font-semibold tabular-nums tracking-[-0.02em] ' + toneClasses[tone]}>{value}</div>
      {sub && <div className="mt-0.5 text-[13px] text-gray-500">{sub}</div>}
    </div>
  );
}
