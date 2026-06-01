'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

export type ReportNavItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  isLive: boolean; // live views render data immediately; queued reports dispatch through queue_report_run
};

const CATEGORY_LABELS: Record<string, string> = {
  accounting:    'Accounting',
  association:   'Association & HOA',
  property_unit: 'Property & units',
  people:        'People',
  maintenance:   'Maintenance',
  compliance:    'Compliance',
  communication: 'Communication',
};

const CATEGORY_ORDER = ['accounting', 'association', 'property_unit', 'people', 'maintenance', 'compliance', 'communication'];

export default function ReportsNav({ items }: { items: ReportNavItem[] }) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');

  const activeSlug = pathname?.startsWith('/reports/')
    ? pathname.slice('/reports/'.length).split('/')[0]
    : null;

  // Filter by search query (name or category)
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((r) =>
      r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q),
    );
  }, [items, query]);

  // Group by category
  const grouped = useMemo(() => {
    const m = new Map<string, ReportNavItem[]>();
    for (const r of filtered) {
      if (!m.has(r.category)) m.set(r.category, []);
      m.get(r.category)!.push(r);
    }
    return m;
  }, [filtered]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-base font-semibold text-gray-900">Reports</h2>
        <p className="mt-0.5 text-xs text-slate-400">{items.length} available</p>
      </div>

      <div className="border-b border-gray-100 px-3 py-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reports…"
          className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {/* Pinned: History link */}
        <Link
          href="/reports/runs"
          className={[
            'mb-3 flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition',
            pathname?.startsWith('/reports/runs')
              ? 'bg-brand-50 text-brand-700'
              : 'text-gray-700 hover:bg-gray-100',
          ].join(' ')}
        >
          <span>Run history</span>
          <span className="text-xs text-gray-400">↗</span>
        </Link>

        {CATEGORY_ORDER.filter((c) => grouped.has(c)).map((cat) => (
          <div key={cat} className="mb-4">
            <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {CATEGORY_LABELS[cat] ?? cat}
            </div>
            <ul>
              {(grouped.get(cat) ?? []).map((r) => {
                const isActive = activeSlug === r.slug;
                return (
                  <li key={r.id}>
                    <Link
                      href={`/reports/${r.slug}`}
                      className={[
                        'group flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition',
                        isActive
                          ? 'bg-brand-600 text-white hover:bg-brand-600'
                          : 'text-gray-700 hover:bg-gray-100',
                      ].join(' ')}
                    >
                      <span className="truncate">{r.name}</span>
                      {r.isLive && (
                        <span
                          className={[
                            'ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            isActive ? 'bg-white/20 text-white' : 'bg-green-100 text-green-700',
                          ].join(' ')}
                        >
                          live
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-slate-400">No reports match "{query}".</p>
        )}
      </nav>
    </div>
  );
}
