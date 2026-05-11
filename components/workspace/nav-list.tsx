'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

export type NavItem = {
  id: string;
  href: string;
  label: string;
  sub?: string;
  rightLabel?: string;
  badge?: { text: string; tone?: 'neutral' | 'danger' | 'warning' | 'positive' | 'info' | 'accent' };
  group?: string;
};

const BADGE_TONE: Record<string, string> = {
  neutral:  'bg-ink-100 text-ink-700',
  danger:   'bg-bordeaux-100 text-bordeaux-700',
  warning:  'bg-champagne-100 text-champagne-800',
  positive: 'bg-sage-100 text-sage-700',
  info:     'bg-cream-200 text-ink-700',
  accent:   'bg-champagne-200 text-champagne-800',
};

export type NavListProps = {
  title: string;
  subtitle?: string;
  items: NavItem[];
  searchPlaceholder?: string;
  groupOrder?: string[];
  groupLabels?: Record<string, string>;
  topActions?: React.ReactNode;
  pinned?: NavItem[];
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
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-ink-100 px-5 py-4">
        <h2 className="font-display text-lg tracking-editorial text-ink-900">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-ink-500">{subtitle}</p>}
      </div>

      {topActions && (
        <div className="border-b border-ink-100 px-3 py-3">{topActions}</div>
      )}

      <div className="border-b border-ink-100 px-3 py-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-full rounded-md border border-ink-200 bg-cream-50 px-3.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-champagne-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-champagne-200/60 transition-colors"
        />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {pinned && pinned.length > 0 && (
          <div className="mb-3 border-b border-ink-100 pb-3">
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
            <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
              {groupLabels?.[g] ?? g}
              <span className="ml-1.5 font-normal tabular-nums text-ink-400">({groups.grouped.get(g)!.length})</span>
            </div>
            <ul>
              {groups.grouped.get(g)!.map((it) => (
                <Row key={it.id} item={it} active={isActive(it.href)} />
              ))}
            </ul>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-ink-500">
            {query ? `No matches for "${query}".` : emptyMessage}
          </p>
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
          'group relative flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors',
          active
            ? 'bg-ink-900 text-cream-50 shadow-soft-sm'
            : pinned
            ? 'bg-cream-100 text-ink-800 hover:bg-cream-200'
            : 'text-ink-700 hover:bg-cream-100',
        ].join(' ')}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-r-full bg-champagne-400" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{item.label}</span>
          {item.sub && (
            <span className={'block truncate text-xs ' + (active ? 'text-cream-300/90' : 'text-ink-500')}>
              {item.sub}
            </span>
          )}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {item.rightLabel && (
            <span className={'tabular-nums text-xs ' + (active ? 'text-cream-300' : 'text-ink-500')}>
              {item.rightLabel}
            </span>
          )}
          {item.badge && (
            <span
              className={[
                'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]',
                active ? 'bg-white/15 text-cream-50' : BADGE_TONE[item.badge.tone ?? 'neutral'],
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
