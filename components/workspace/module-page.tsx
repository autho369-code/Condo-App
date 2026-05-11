// Shared shell for module list pages so every page reads as part of the
// same editorial system.
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';

export function ModulePage({
  title, description, newHref, newLabel, children, breadcrumb, eyebrow,
}: {
  title: string;
  description?: string;
  newHref?: string;
  newLabel?: string;
  breadcrumb?: { href: string; label: string }[];
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-8">
      <div className="space-y-7">
        {breadcrumb && (
          <nav className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">
            {breadcrumb.map((b, i) => (
              <span key={b.href}>
                {i > 0 && <span className="mx-2 text-ink-300">/</span>}
                <Link href={b.href} className="hover:text-champagne-700 transition-colors">
                  {b.label}
                </Link>
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-end justify-between gap-6 border-b border-ink-100 pb-7">
          <div className="max-w-2xl">
            {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
            <h1 className="font-display text-4xl tracking-editorial text-ink-900">{title}</h1>
            {description && (
              <p className="mt-3 text-[15px] text-ink-500 leading-relaxed">{description}</p>
            )}
          </div>
          {newHref && (
            <Link href={newHref}>
              <Button size="md" variant="primary">
                {newLabel ?? '+ New'}
              </Button>
            </Link>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Placeholder for modules whose feature/table isn't built yet. */
export function ComingSoon({
  reason, supabaseTable, roadmapPhase,
}: {
  reason?: string;
  supabaseTable?: string;
  roadmapPhase?: string;
}) {
  return (
    <div className="rounded-lg border border-champagne-300 bg-champagne-50/60 p-7 shadow-soft-sm">
      <div className="eyebrow mb-2 text-champagne-700">In development</div>
      {reason && <p className="font-display text-lg tracking-editorial text-ink-900">{reason}</p>}
      <dl className="mt-5 grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
        {supabaseTable && (
          <div>
            <dt className="text-ink-500 uppercase tracking-[0.12em]">Backing table</dt>
            <dd className="mt-1 font-mono text-ink-800">{supabaseTable}</dd>
          </div>
        )}
        {roadmapPhase && (
          <div>
            <dt className="text-ink-500 uppercase tracking-[0.12em]">Roadmap</dt>
            <dd className="mt-1 text-ink-800">{roadmapPhase}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
