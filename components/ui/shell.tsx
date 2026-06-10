import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/* ────────────────────────────────────────────────────────────────────────
   Portier369 Design System — shared layout primitives
   One source of truth for page structure so every screen reads as one
   product. Light content surface (#f6f7f9), white cards, gray-950 ink,
   blue-600 accent, generous spacing, soft layered shadows.
   ──────────────────────────────────────────────────────────────────────── */

/** Full-bleed page surface. Wrap every page body in this. */
export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="min-h-full bg-[#f6f7f9]">
      <div className={cn('mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7', className)}>
        {children}
      </div>
    </div>
  );
}

/** Page header: title, optional eyebrow + description, right-aligned actions. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">{eyebrow}</div>
        )}
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Breadcrumb trail. Pass [{label, href?}]. Last item renders as current. */
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-[12px] text-gray-400">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {it.href && i < items.length - 1 ? (
            <Link href={it.href} className="font-medium text-gray-500 transition-colors hover:text-gray-900">
              {it.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? 'font-medium text-gray-700' : ''}>{it.label}</span>
          )}
          {i < items.length - 1 && <span className="text-gray-300">/</span>}
        </React.Fragment>
      ))}
    </nav>
  );
}

/** Surface card — the default container for content sections. */
export function Surface({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.04)]',
        padded && 'p-5 sm:p-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Section heading inside a surface. */
export function SectionTitle({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-gray-950">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] leading-5 text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Status badge ─────────────────────────────────────────────────────── */

type Tone = 'open' | 'progress' | 'pending' | 'complete' | 'waiting' | 'inactive' | 'danger' | 'info';

const TONE_STYLES: Record<Tone, string> = {
  open: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  progress: 'bg-indigo-50 text-indigo-700 ring-indigo-600/15',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/15',
  complete: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  waiting: 'bg-purple-50 text-purple-700 ring-purple-600/15',
  inactive: 'bg-gray-100 text-gray-500 ring-gray-500/15',
  danger: 'bg-red-50 text-red-700 ring-red-600/15',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/15',
};

/** Map common status strings to a tone so badges stay consistent app-wide. */
export function toneForStatus(status?: string | null): Tone {
  const s = (status ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  if (['open', 'new', 'active', 'scheduled', 'outstanding'].includes(s)) return 'open';
  if (['in_progress', 'assigned', 'processing', 'partial'].includes(s)) return 'progress';
  if (['pending', 'pending_approval', 'draft', 'submitted', 'review'].includes(s)) return 'pending';
  if (['complete', 'completed', 'done', 'paid', 'approved', 'resolved', 'cured', 'closed'].includes(s)) return 'complete';
  if (['waiting', 'on_hold', 'hold'].includes(s)) return 'waiting';
  if (['cancelled', 'canceled', 'void', 'rejected', 'failed', 'overdue', 'escalated', 'expired'].includes(s)) return 'danger';
  if (['inactive', 'archived', 'past', 'na'].includes(s)) return 'inactive';
  return 'info';
}

export function Badge({
  children,
  tone,
  status,
  className,
}: {
  children?: React.ReactNode;
  tone?: Tone;
  status?: string | null;
  className?: string;
}) {
  const t = tone ?? toneForStatus(status);
  const label = children ?? (status ? status.replace(/_/g, ' ') : '');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset',
        TONE_STYLES[t],
        className,
      )}
    >
      {label}
    </span>
  );
}

/* ── Metric strip ─────────────────────────────────────────────────────── */

export function MetricStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className)}>{children}</div>
  );
}

export function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: 'blue' | 'emerald' | 'amber' | 'red' | 'violet';
}) {
  const bar: Record<string, string> = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    violet: 'bg-violet-500',
  };
  return (
    <Surface padded={false} className="overflow-hidden p-4">
      {accent && <div className={cn('mb-3 h-1 w-8 rounded-full', bar[accent])} />}
      <div className="text-[12px] font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-gray-950">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-gray-400">{sub}</div>}
    </Surface>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ElementType;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-5 text-gray-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Inline alert / banner ────────────────────────────────────────────── */

export function Alert({
  tone = 'danger',
  title,
  children,
  className,
}: {
  tone?: 'danger' | 'success' | 'warning' | 'info';
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const styles = {
    danger: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-blue-200 bg-blue-50 text-blue-800',
  };
  return (
    <div role="alert" className={cn('rounded-xl border px-4 py-3 text-[13px] leading-5', styles[tone], className)}>
      {title && <span className="font-semibold">{title} </span>}
      {children}
    </div>
  );
}
