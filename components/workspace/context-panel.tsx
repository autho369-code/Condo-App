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
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-gray-200 bg-white">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        {/* Decorative close — panel remains mounted; stub until client-side toggle exists */}
        <span className="cursor-pointer text-gray-400 hover:text-gray-600" aria-hidden="true">×</span>
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
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        {icon && <span className="text-gray-500">{icon}</span>}
        <span>{title}</span>
      </div>
      <ul className="space-y-1.5">{children}</ul>
    </div>
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
