'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

export type NavItem = {
  id: string;
  href: string;
  label: string;
  sub?: string;           // secondary line under label
  rightLabel?: string;    // right-aligned text (e.g. "$420")
  badge?: { text: string; tone?: 'neutral' | 'danger' | 'warning' | 'positive' | 'info' };
  group?: string;         // group key; optional — if absent items render flat
};

const BADGE_TONE: Record<string, string> = {
  neutral:  'bg-gray-100 text-gray-600',
  danger:   'bg-red-100 text-red-700',
  warning:  'bg-amber-100 text-amber-700',
  positive: 'bg-green-100 text-green-700',
  info:     'bg-blue-100 text-blue-700',
};

export type NavListProps = {
  title: string;
  subtitle?: string;
  items: NavItem[];
  searchPlaceholder?: string;
  groupOrder?: string[];
  groupLabels?: Record<string, string>;
  topActions?: React.ReactNode;   // e.g. "+ New bill" button
  pinned?: NavItem[];             // pinned links shown above groups
  emptyMessage?: string;
};

export default function NavList({
  title, subtitle, items, searchPlaceholder = 'Search…',
  groupOrder, groupLabels, topActions, pinned, emptyMessage = 'Nothing yet.',
}: NavListProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((i) =>
      i.label.toLowerCase().includes(q) ||
      i.sub?.toLowerCase().includes(q) ||
      i.group?.toLowerCase().includes(q),
    );
  }, [items, query]);

  const groups = useMemo(() => {
    const m = new Map<string, NavItem[]>();
    const flat: NavItem[] = [];
    for (const it of filtered) {
      if (!it.group) { flat.push(it); continue; }
      if (!m.has(it.group)) m.set(it.group, []);
      m.get(it.group)!.push(it);
    }
    return { grouped: m, flat };
  }, [filtered]);

  const orderedGroupKeys = useMemo(() => {
    const existing = Array.from(groups.grouped.keys());
    if (!groupOrder) return existing.sort();
    const inOrder = groupOrder.filter((g) => groups.grouped.has(g));
    const extras  = existing.filter((g) => !groupOrder.includes(g));
    return [...inOrder, ...extras];
  }, [groups, groupOrder]);

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>

      {topActions && (
        <div className="border-b border-gray-100 px-3 py-2">{topActions}</div>
      )}

      <div className="border-b border-gray-100 px-3 py-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {pinned && pinned.length > 0 && (
          <div className="mb-3 border-b border-gray-100 pb-3">
            {pinned.map((it) => (
              <Row key={it.id} item={it} active={isActive(it.href)} pinned />
            ))}
          </div>
        )}

        {groups.flat.length > 0 && (
          <ul>
            {groups.flat.map((it) => (
              <Row key={it.id} item={it} active={isActive(it.href)} />
            ))}
          </ul>
        )}

        {orderedGroupKeys.map((g) => (
          <div key={g} className="mb-4">
            <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {groupLabels?.[g] ?? g}
              <span className="ml-1 font-normal tabular-nums text-gray-400">({groups.grouped.get(g)!.length})</span>
            </div>
            <ul>
              {groups.grouped.get(g)!.map((it) => (
                <Row key={it.id} item={it} active={isActive(it.href)} />
              ))}
            </ul>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-gray-500">{query ? `No matches for "${query}".` : emptyMessage}</p>
        )}
      </nav>
    </div>
  );
}

function Row({ item, active, pinned = false }: { item: NavItem; active: boolean; pinned?: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        className={[
          'group flex items-center justify-between gap-2 rounded-md px-3 py-1.5 text-sm transition',
          active
            ? 'bg-brand-600 text-white hover:bg-brand-600'
            : pinned
            ? 'bg-gray-50 text-gray-800 hover:bg-gray-100'
            : 'text-gray-700 hover:bg-gray-100',
        ].join(' ')}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">{item.label}</span>
          {item.sub && (
            <span className={'block truncate text-xs ' + (active ? 'text-white/80' : 'text-gray-500')}>{item.sub}</span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {item.rightLabel && (
            <span className={'tabular-nums ' + (active ? 'text-white/80 text-xs' : 'text-xs text-gray-500')}>
              {item.rightLabel}
            </span>
          )}
          {item.badge && (
            <span
              className={[
                'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                active ? 'bg-white/20 text-white' : BADGE_TONE[item.badge.tone ?? 'neutral'],
              ].join(' ')}
            >
              {item.badge.text}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
