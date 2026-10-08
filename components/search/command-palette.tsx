'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock, CornerDownLeft, FileText, Plus, Search } from 'lucide-react';
import { SEARCH_TYPE_LABEL, type SearchResult } from '@/lib/search/global';

export type PaletteLink = { label: string; href: string; section?: string };

type Item =
  | { kind: 'record'; key: string; group: string; title: string; subtitle?: string; href: string }
  | { kind: 'page' | 'action' | 'recent'; key: string; group: string; title: string; subtitle?: string; href: string };

const RECENT_KEY = 'portier369.palette.recent';
export const OPEN_PALETTE_EVENT = 'portier369:open-command-palette';

function readRecent(): Item[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function rememberRecent(item: Item) {
  try {
    const next = [{ ...item, kind: 'recent', group: 'Recent', key: `recent:${item.href}` }, ...readRecent().filter((r) => r.href !== item.href)].slice(0, 6);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

function isTypingTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}

export function CommandPalette({ pages, actions }: { pages: PaletteLink[]; actions: PaletteLink[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [records, setRecords] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [recent, setRecent] = React.useState<Item[]>([]);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const returnFocus = React.useRef<HTMLElement | null>(null);

  // Open: Ctrl/Cmd+K anywhere, "/" when not typing, or the sidebar trigger event.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === '/' && !isTypingTarget(e.target) && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setRecent(readRecent());
      setQuery('');
      setRecords([]);
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      returnFocus.current?.focus?.();
    }
  }, [open]);

  // Debounced record search.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setRecords([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        setRecords(Array.isArray(body.results) ? body.results : []);
        setFailed(false);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open]);

  const items: Item[] = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [
        ...recent,
        ...actions.slice(0, 6).map((a) => ({ kind: 'action' as const, key: `action:${a.href}`, group: 'Quick actions', title: a.label, subtitle: a.section, href: a.href })),
      ];
    }
    const matches = (l: PaletteLink) => `${l.label} ${l.section ?? ''}`.toLowerCase().includes(q);
    const recordItems: Item[] = records.map((r) => ({ kind: 'record', key: `${r.type}:${r.id}`, group: SEARCH_TYPE_LABEL[r.type], title: r.title, subtitle: r.subtitle, href: r.href }));
    return [
      ...recordItems,
      ...pages.filter(matches).slice(0, 6).map((p) => ({ kind: 'page' as const, key: `page:${p.href}`, group: 'Pages', title: p.label, subtitle: p.section, href: p.href })),
      ...actions.filter(matches).slice(0, 4).map((a) => ({ kind: 'action' as const, key: `action:${a.href}`, group: 'Quick actions', title: a.label, subtitle: a.section, href: a.href })),
    ];
  }, [query, records, pages, actions, recent]);

  React.useEffect(() => setActive(0), [query, records.length]);
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    if (item.kind === 'record' || item.kind === 'page') rememberRecent(item);
    setOpen(false);
    router.push(item.href);
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(items[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
  };

  if (!open) return null;

  let lastGroup = '';
  const q = query.trim();

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-gray-950/40 px-4 pt-[10vh] backdrop-blur-[2px]" onMouseDown={() => setOpen(false)}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_24px_64px_-16px_rgba(16,24,40,0.35)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-4">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search owners, units, vendors, work orders, pages…"
            className="h-14 w-full bg-transparent text-[15px] text-gray-950 outline-none placeholder:text-gray-400"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={items[active] ? `palette-item-${active}` : undefined}
            aria-autocomplete="list"
            maxLength={80}
          />
          <kbd className="hidden shrink-0 rounded-md border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-400 sm:block">Esc</kbd>
        </div>

        <div ref={listRef} id="command-palette-list" role="listbox" aria-label="Results" className="max-h-[60vh] overflow-y-auto py-2">
          {items.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const Icon = item.kind === 'action' ? Plus : item.kind === 'recent' ? Clock : item.kind === 'page' ? ArrowRight : FileText;
            return (
              <React.Fragment key={item.key}>
                {header && <div className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{header}</div>}
                <div
                  id={`palette-item-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={index === active}
                  onMouseMove={() => setActive(index)}
                  onClick={() => go(item)}
                  className={`mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${index === active ? 'bg-gray-100' : ''}`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-gray-950">{item.title}</div>
                    {item.subtitle && <div className="truncate text-[12px] capitalize text-gray-500">{item.subtitle}</div>}
                  </div>
                  {index === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                </div>
              </React.Fragment>
            );
          })}

          {q.length >= 2 && !loading && !failed && items.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-gray-500">No matches for “{q}”.</div>
          )}
          {q.length === 1 && <div className="px-4 py-6 text-center text-sm text-gray-400">Keep typing to search records…</div>}
          {failed && <div className="px-4 py-3 text-center text-[13px] text-red-700">Search is unavailable right now. Pages and actions still work.</div>}
          {loading && <div className="px-4 py-2 text-[12px] text-gray-400">Searching…</div>}
        </div>

        <div className="hidden items-center gap-4 border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400 sm:flex">
          <span><kbd className="font-sans">↑↓</kbd> navigate</span>
          <span><kbd className="font-sans">↵</kbd> open</span>
          <span className="ml-auto"><kbd className="font-sans">Ctrl K</kbd> or <kbd className="font-sans">/</kbd> anywhere</span>
        </div>
      </div>
    </div>
  );
}

/** Small trigger for places that should advertise the palette. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}
