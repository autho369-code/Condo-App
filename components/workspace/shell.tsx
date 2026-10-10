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
      <div className="shrink-0 border-b border-line bg-white px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {header}
      </div>
      <div data-workspace-main className="bg-canvas px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        {rail ? (
          // The rail is a card inside the content area (not a fourth page
          // column): above the content on small screens, beside it on wide ones.
          <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
            <aside data-workspace-rail className="rounded-2xl border border-line bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] xl:sticky xl:top-4 xl:order-2">
              {rail}
            </aside>
            <div className="min-w-0 xl:order-1">{children}</div>
          </div>
        ) : children}
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
      <div className={padded ? 'px-5 py-5' : ''}>{children}</div>
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
  const cls = 'block rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition';
  const body = (
    <>
      <div className="text-[13px] font-medium text-gray-500">{label}</div>
      <div className={'mt-1 font-display text-[24px] font-semibold tabular-nums tracking-[-0.02em] ' + TONE_CLS[tone]}>{value}</div>
      {sub && <div className="mt-0.5 text-[13px] text-gray-500">{sub}</div>}
    </>
  );
  if (href) {
    return <Link href={href} className={cls + ' hover:border-gray-300 hover:bg-gray-50/60'}>{body}</Link>;
  }
  return <div className={cls}>{body}</div>;
}
