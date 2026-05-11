// Right-hand contextual panel — the "concierge" rail.
import Link from 'next/link';
import * as React from 'react';

const PLACEHOLDER_HREFS = new Set([
  '/assessments/update',
  '/unit-types/new',
  '/bank-transfers/new',
  '/journal-entries/new',
  '/charges/new',
  '/fixed-assets/new',
  '/forms/new',
  '/gl-accounts/new',
  '/inspections/new',
  '/inventory/new',
  '/letters/new',
  '/projects/new',
  '/purchase-orders/new',
  '/recurring-work-orders/new',
  '/scheduled-reports/new',
  '/surveys/new',
  '/unit-turns/new',
]);

export function ContextPanel({
  title = 'Tasks',
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-ink-100 bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-100 bg-white/95 px-6 py-4 backdrop-blur-sm">
        <h2 className="font-display text-lg tracking-editorial text-ink-900">{title}</h2>
        <span className="cursor-pointer text-ink-400 hover:text-ink-700 transition-colors" aria-hidden="true">×</span>
      </div>
      <div className="space-y-6 px-6 py-5">{children}</div>
    </aside>
  );
}

export function PanelSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="eyebrow mb-2 flex items-center gap-2">
        {icon && <span className="text-champagne-600">{icon}</span>}
        <span>{title}</span>
      </div>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

export function PanelLink({
  href,
  children,
  status,
}: {
  href: string;
  children: React.ReactNode;
  status?: 'ready' | 'placeholder';
}) {
  const isPlaceholder = status === 'placeholder' || href === '#' || href.startsWith('/help/') || PLACEHOLDER_HREFS.has(href);
  if (isPlaceholder) {
    return (
      <li>
        <span className="block rounded border border-dashed border-amber-300 bg-amber-50 px-2 py-1.5 text-sm text-amber-900">
          {children}
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-amber-700">Placeholder</span>
        </span>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={href}
        className="block text-sm text-ink-800 underline decoration-champagne-300 decoration-1 underline-offset-4 hover:text-champagne-700 hover:decoration-champagne-500 transition-colors"
      >
        {children}
      </Link>
    </li>
  );
}

export function PanelDropdown({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <li>
      <details className="rounded-md border border-ink-100 bg-cream-50/60" open={defaultOpen}>
        <summary className="cursor-pointer select-none px-3.5 py-2.5 text-sm font-medium text-ink-800 hover:text-champagne-700 transition-colors">
          {title}
        </summary>
        <div className="border-t border-ink-100 px-3.5 py-2.5">
          <ul className="space-y-2">{children}</ul>
        </div>
      </details>
    </li>
  );
}
