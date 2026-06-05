// Right-hand contextual panel. Dark theme matching marketing design language.
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
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-800/80 bg-[#0B1121]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800/80 bg-[#0B1121] px-5 py-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
        <span className="cursor-pointer text-slate-600 hover:text-slate-400 transition-colors" aria-hidden="true">×</span>
      </div>
      <div className="space-y-6 px-5 py-4">{children}</div>
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
      <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {icon && <span className="text-slate-500">{icon}</span>}
        <span>{title}</span>
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="block px-3 py-2 rounded-lg text-[13px] text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all border border-transparent hover:border-emerald-500/20">
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
      <details className="rounded-xl border border-slate-800 bg-[#0A1628] overflow-hidden" open={defaultOpen}>
        <summary className="cursor-pointer select-none px-3 py-2.5 text-[13px] font-medium text-slate-300 hover:text-white transition-colors">
          {title}
        </summary>
        <div className="border-t border-slate-800/60 px-3 py-2">
          <ul className="space-y-0.5">{children}</ul>
        </div>
      </details>
    </li>
  );
}
