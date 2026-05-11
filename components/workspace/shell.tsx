// Editorial three-column workspace primitives. Used across Reports,
// Work Orders, Units, Bills, and the platform Dashboard.
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
    <div className="flex h-full bg-cream-50">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-ink-100 bg-white/80 px-8 py-6 backdrop-blur-sm">
          {header}
        </div>
        <div data-workspace-main className="flex-1 overflow-y-auto px-8 py-7">{children}</div>
      </div>
      {rail && (
        <aside data-workspace-rail className="w-80 shrink-0 overflow-y-auto border-l border-ink-100 bg-white px-6 py-7">
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
    <div className="flex items-end justify-between gap-6">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="font-display text-3xl tracking-editorial text-ink-900">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-500 max-w-xl">{subtitle}</p>}
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
    <section
      className={
        'mb-7 overflow-hidden rounded-lg border border-ink-100 bg-white shadow-soft-sm ' + (className ?? '')
      }
    >
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            {title && (
              <h2 className="font-display text-lg tracking-editorial text-ink-900">{title}</h2>
            )}
            {subtitle && <p className="mt-1 text-xs text-ink-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? 'px-6 py-5' : ''}>{children}</div>
    </section>
  );
}

type TileTone = 'neutral' | 'danger' | 'warning' | 'positive' | 'info' | 'accent';

const TONE_CLS: Record<TileTone, string> = {
  neutral:  'text-ink-900',
  danger:   'text-bordeaux-700',
  warning:  'text-champagne-700',
  positive: 'text-sage-700',
  info:     'text-ink-700',
  accent:   'text-champagne-700',
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
  const cls =
    'block rounded-lg border border-ink-100 bg-white px-5 py-4 transition-all duration-150 shadow-soft-sm';
  const body = (
    <>
      <div className="eyebrow">{label}</div>
      <div className={'mt-2 font-display text-2xl number-plate tracking-editorial ' + TONE_CLS[tone]}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-500">{sub}</div>}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className={cls + ' hover:border-champagne-300 hover:shadow-soft hover:-translate-y-px'}
      >
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
