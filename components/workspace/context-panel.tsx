// Right-hand contextual panel. Matches AppFolio's sidebar-right pattern.
import Link from 'next/link';
import * as React from 'react';

export function ContextPanel({
  title = 'Tasks',
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-gray-200 bg-white xl:block">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-5 py-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="space-y-5 px-5 py-4">{children}</div>
    </aside>
  );
}

/** A section inside the context panel, with a small icon-ish label. */
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
    <details className="group rounded border border-gray-200 bg-white" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-gray-700">
        <span className="flex min-w-0 items-center gap-1.5">
          {icon && <span className="text-gray-500">{icon}</span>}
          <span className="truncate">{title}</span>
        </span>
        <span className="text-xs text-gray-400 group-open:rotate-180">v</span>
      </summary>
      <ul className="space-y-1.5 border-t border-gray-100 px-3 py-2">{children}</ul>
    </details>
  );
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="block text-sm text-blue-700 hover:underline">
        {children}
      </Link>
    </li>
  );
}
