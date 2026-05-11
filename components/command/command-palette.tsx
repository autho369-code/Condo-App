'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// =============================================================================
// Command palette
// =============================================================================
// A self-contained Cmd+K palette that renders a centered, inverted-pill
// dialog for navigating + acting across the whole product. Pure React,
// no external dependencies — modeled after cmdk's keystroke + filter logic.
//
// Trigger keys: Cmd+K (mac) / Ctrl+K (win/linux) / press "/" anywhere.
// Esc closes. Up/Down moves focus, Enter executes the highlighted item.
// =============================================================================

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;          // secondary right-aligned info (e.g. shortcut)
  group: string;          // section header
  keywords?: string[];    // additional searchable terms
  perform: () => void | Promise<void>;
  icon?: React.ReactNode;
};

type Props = {
  items: CommandItem[];
  /** Override default trigger keys ('mod+k', '/'). */
  triggers?: string[];
};

export function CommandPalette({ items, triggers }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  // Global trigger keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      // Cmd/Ctrl+K
      if (isMod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      // "/" while not typing in an input/textarea
      if (e.key === '/' && !isInteractive(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
      // Escape inside palette → close
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, triggers]);

  // Focus the input when opening
  useEffect(() => {
    if (open) {
      // Defer to next tick so the DOM is in place
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Filter + group
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items.filter((it) =>
          it.label.toLowerCase().includes(q) ||
          it.group.toLowerCase().includes(q) ||
          it.keywords?.some((k) => k.toLowerCase().includes(q)),
        )
      : items;
    // Group by group key (preserving the order each item declared)
    const groups: Array<{ name: string; items: CommandItem[] }> = [];
    const byName = new Map<string, CommandItem[]>();
    for (const it of list) {
      if (!byName.has(it.group)) {
        const arr: CommandItem[] = [];
        byName.set(it.group, arr);
        groups.push({ name: it.group, items: arr });
      }
      byName.get(it.group)!.push(it);
    }
    return { flat: list, groups };
  }, [items, query]);

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  function moveActive(delta: number) {
    setActiveIndex((i) => {
      const len = filtered.flat.length;
      if (!len) return 0;
      return ((i + delta) % len + len) % len;
    });
  }

  async function executeActive() {
    const it = filtered.flat[activeIndex];
    if (!it) return;
    close();
    await it.perform();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[100] flex items-start justify-center bg-ink-950/40 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        // Click outside the panel to close
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="w-full max-w-[640px] overflow-hidden rounded-xl border border-ink-200 bg-cream-50 shadow-soft-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-ink-100 px-5 py-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-ink-400" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions, residents…"
            className="flex-1 bg-transparent text-[15px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
              else if (e.key === 'Enter') { e.preventDefault(); executeActive(); }
            }}
          />
          <kbd className="hidden items-center gap-1 rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-500 sm:inline-flex">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {filtered.flat.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-ink-500">
              No matches for <span className="text-ink-700 font-medium">"{query}"</span>.
            </div>
          ) : (
            filtered.groups.map((g) => (
              <div key={g.name} className="mb-3 last:mb-0">
                <div className="px-5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                  {g.name}
                </div>
                <ul>
                  {g.items.map((it) => {
                    const flatIndex = filtered.flat.indexOf(it);
                    const active = flatIndex === activeIndex;
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveIndex(flatIndex)}
                          onClick={() => {
                            close();
                            void it.perform();
                          }}
                          className={
                            'group flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left transition-colors ' +
                            (active ? 'bg-ink-900 text-cream-50' : 'text-ink-800 hover:bg-cream-100')
                          }
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            {it.icon && (
                              <span className={'flex h-5 w-5 items-center justify-center ' + (active ? 'text-champagne-300' : 'text-ink-500')}>
                                {it.icon}
                              </span>
                            )}
                            <span className="truncate text-[14px]">{it.label}</span>
                          </span>
                          {it.hint && (
                            <span className={'shrink-0 text-[11px] uppercase tracking-[0.1em] ' + (active ? 'text-cream-300' : 'text-ink-400')}>
                              {it.hint}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between border-t border-ink-100 bg-cream-100 px-5 py-2.5 text-[11px] text-ink-500">
          <div className="flex items-center gap-3">
            <Hint kbd="↑↓" label="Navigate" />
            <Hint kbd="↵" label="Open" />
            <Hint kbd="ESC" label="Close" />
          </div>
          <span className="font-display tracking-editorial text-ink-700">Portier</span>
        </div>
      </div>
    </div>
  );
}

function Hint({ kbd, label }: { kbd: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="rounded border border-ink-200 bg-white px-1.5 py-0.5 font-medium text-ink-700">{kbd}</kbd>
      <span>{label}</span>
    </span>
  );
}

function isInteractive(t: EventTarget | null): boolean {
  if (!t || !(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

// =============================================================================
// Hook for navigation-style commands
// =============================================================================
export function useCommandNavigate() {
  const router = useRouter();
  return useCallback(
    (href: string) => () => router.push(href),
    [router],
  );
}
