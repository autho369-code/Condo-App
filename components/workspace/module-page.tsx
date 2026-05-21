// Shared shell for module list pages so every page looks consistent.
import Link from 'next/link';
import * as React from 'react';
import { Button } from '@/components/ui/button';

export function ModulePage({
  title, description, newHref, newLabel, children, breadcrumb,
}: {
  title: string;
  description?: string;
  newHref?: string;
  newLabel?: string;
  breadcrumb?: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-6">
      <div className="space-y-6">
        {breadcrumb && (
          <nav className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {breadcrumb.map((b, i) => (
              <span key={b.href}>
                {i > 0 && <span className="mx-1">/</span>}
                <Link href={b.href} className="hover:text-brand-600">{b.label}</Link>
              </span>
            ))}
          </nav>
        )}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
          </div>
          {newHref && (
            <Link href={newHref}><Button size="sm">{newLabel ?? '+ New'}</Button></Link>
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
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-800">Coming soon</div>
      {reason && <p className="text-sm text-amber-900">{reason}</p>}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
        {supabaseTable && (
          <div>
            <dt className="text-amber-700">Backing table</dt>
            <dd className="mt-0.5 font-mono text-amber-900">{supabaseTable}</dd>
          </div>
        )}
        {roadmapPhase && (
          <div>
            <dt className="text-amber-700">Roadmap</dt>
            <dd className="mt-0.5 text-amber-900">{roadmapPhase}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
