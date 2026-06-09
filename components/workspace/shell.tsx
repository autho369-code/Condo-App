// Generic three-column workspace primitives. Used by Reports, Work Orders,
// Units, Bills, and Dashboard. The parent page layout.tsx applies negative
// margins to break out of the app's max-width container.
import * as React from 'react';
import Link from 'next/link';

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
      <div data-workspace-main className="bg-gray-50 px-8 py-6">
        {children}
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

export function Section({
  title,
  subtitle,
  actions,
  children,
  className,
  padded = false,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
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
      <div className={padded ? 'px-5 py-4' : ''}>{children}</div>
    </section>
  );
}

type TileTone = 'neutral' | 'danger' | 'warning' | 'positive' | 'info';

const TONE_CLS: Record<TileTone, string> = {
  neutral:  'text-gray-900',
  danger:   'text-red-700',
  warning:  'text-amber-700',
  positive: 'text-green-700',
  info:     'text-blue-700',
};

export function Tile({
  label,
  value,
  sub,
  tone = 'neutral',
  href,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: TileTone;
  href?: string;
}) {
  const cls = 'block rounded-md border border-gray-200 bg-white px-4 py-3 transition';
  const body = (
    <>
      <div className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</div>
      <div className={'mt-1 text-xl font-semibold tabular-nums ' + TONE_CLS[tone]}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </>
  );
  if (href) {
    return <Link href={href} className={cls + ' hover:border-brand-500 hover:bg-brand-50'}>{body}</Link>;
  }
  return <div className={cls}>{body}</div>;
}
