'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ArrowUpRight,
  AlertTriangle,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/shell';
import {
  getActionCenter,
  canAccessActionLink,
  type ActionCenterLink,
  type ActionCenterSection,
  type ActionCenterTab,
} from '@/lib/navigation/action-center';
import type { ActionCenterAttentionItem } from '@/lib/navigation/action-center-attention';

const STORAGE_KEY = 'p369.actionCenter.v1';
const TAB_META: Record<ActionCenterTab, { label: string; icon: React.ElementType }> = {
  work: { label: 'Work', icon: BriefcaseBusiness },
  reports: { label: 'Reports', icon: BarChart3 },
  help: { label: 'Help', icon: BookOpen },
};

type StoredPreferences = {
  desktopOpen?: boolean;
  pinned?: ActionCenterLink[];
};

type TasksRailProps = {
  isStaff?: boolean;
  isFinanceStaff?: boolean;
  isAdmin?: boolean;
  attention?: ActionCenterAttentionItem[];
};

function AttentionList({
  items,
  idPrefix,
  onNavigate,
}: {
  items: ActionCenterAttentionItem[];
  idPrefix: string;
  onNavigate?: () => void;
}) {
  if (items.length === 0) return null;
  const headingId = `${idPrefix}-attention`;
  return (
    <section className="border-b border-gray-100 bg-white px-3 py-3" aria-labelledby={headingId}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h3 id={headingId} className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
          <AlertTriangle className="h-3 w-3 text-amber-500" /> Needs attention
        </h3>
        <span className="text-[10px] text-gray-400">Current</span>
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              className="flex min-h-10 items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-[12px] text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              aria-label={`${item.count} ${item.label}`}
            >
              <span className="leading-4">{item.label}</span>
              <Badge tone={item.tone} className="shrink-0 tabular-nums">{item.count}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function readPreferences(): StoredPreferences {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as StoredPreferences : {};
  } catch {
    return {};
  }
}

function writePreferences(next: StoredPreferences) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The Action Center remains fully usable when storage is unavailable.
  }
}

function ActionRow({
  item,
  pinned,
  onTogglePin,
  onNavigate,
}: {
  item: ActionCenterLink;
  pinned: boolean;
  onTogglePin: (item: ActionCenterLink) => void;
  onNavigate?: () => void;
}) {
  return (
    <li className={item.primary ? 'rounded-xl border border-gray-200 bg-gray-950 text-white shadow-sm' : 'group rounded-xl border border-transparent hover:border-gray-200 hover:bg-white'}>
      <div className="flex items-start gap-1">
        <Link
          href={item.href}
          onClick={onNavigate}
          className={item.primary
            ? 'min-h-10 min-w-0 flex-1 px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white'
            : 'min-h-10 min-w-0 flex-1 px-3 py-2.5 focus-visible:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-400'}
        >
          <span className="flex items-center justify-between gap-2">
            <span className={item.primary ? 'text-[13px] font-semibold text-white' : 'text-[13px] font-medium text-gray-800'}>{item.label}</span>
            {item.primary
              ? <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500" />}
          </span>
          {item.description ? (
            <span className={item.primary ? 'mt-1 block text-[11px] leading-4 text-gray-300' : 'mt-1 block text-[11px] leading-4 text-gray-500'}>
              {item.description}
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={() => onTogglePin(item)}
          className={item.primary
            ? 'mr-1 mt-1.5 rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white'
            : 'mr-1 mt-1.5 rounded-lg p-2 text-gray-300 opacity-60 hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400'}
          aria-label={`${pinned ? 'Unpin' : 'Pin'} ${item.label}`}
          aria-pressed={pinned}
          title={`${pinned ? 'Unpin' : 'Pin'} action`}
        >
          <Pin className={`h-3.5 w-3.5 ${pinned ? 'fill-current' : ''}`} />
        </button>
      </div>
    </li>
  );
}

function SectionBlock({
  section,
  idPrefix,
  pinnedHrefs,
  onTogglePin,
  onNavigate,
}: {
  section: ActionCenterSection;
  idPrefix: string;
  pinnedHrefs: Set<string>;
  onTogglePin: (item: ActionCenterLink) => void;
  onNavigate?: () => void;
}) {
  return (
    <section aria-labelledby={`${idPrefix}-${section.tab}-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h3
          id={`${idPrefix}-${section.tab}-${section.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
          className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400"
        >
          {section.title}
        </h3>
        <span className="text-[10px] tabular-nums text-gray-300">{section.links.length}</span>
      </div>
      <ul className="space-y-1">
        {section.links.map((item) => (
          <ActionRow
            key={`${item.href}-${item.label}`}
            item={item}
            pinned={pinnedHrefs.has(item.href)}
            onTogglePin={onTogglePin}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </section>
  );
}

function ActionCenterBody({
  sections,
  idPrefix,
  query,
  pinned,
  onTogglePin,
  onNavigate,
}: {
  sections: ActionCenterSection[];
  idPrefix: string;
  query: string;
  pinned: ActionCenterLink[];
  onTogglePin: (item: ActionCenterLink) => void;
  onNavigate?: () => void;
}) {
  const term = query.trim().toLowerCase();
  const visibleSections = React.useMemo(() => sections
    .map((section) => ({
      ...section,
      links: term
        ? section.links.filter((link) => `${link.label} ${link.description ?? ''} ${section.title}`.toLowerCase().includes(term))
        : section.links,
    }))
    .filter((section) => section.links.length > 0), [sections, term]);
  const pinnedHrefs = React.useMemo(() => new Set(pinned.map((item) => item.href)), [pinned]);

  if (visibleSections.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <Search className="mx-auto h-5 w-5 text-gray-300" />
        <p className="mt-3 text-sm font-medium text-gray-700">No matching actions</p>
        <p className="mt-1 text-xs leading-5 text-gray-400">Try a workflow, report, or task name.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-3 py-4">
      {visibleSections.map((section) => (
        <SectionBlock
          key={`${section.tab}-${section.title}`}
          section={section}
          idPrefix={idPrefix}
          pinnedHrefs={pinnedHrefs}
          onTogglePin={onTogglePin}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

function TasksRailInner({ isStaff = false, isFinanceStaff = false, isAdmin = false, attention = [] }: TasksRailProps) {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const view = searchParams?.get('view') ?? '';
  const panel = React.useMemo(
    () => getActionCenter(pathname, view, { isStaff, isFinanceStaff, isAdmin }),
    [pathname, view, isStaff, isFinanceStaff, isAdmin],
  );
  const [desktopOpen, setDesktopOpen] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<ActionCenterTab>('work');
  const [query, setQuery] = React.useState('');
  const [pinned, setPinned] = React.useState<ActionCenterLink[]>([]);
  const desktopSearchRef = React.useRef<HTMLInputElement>(null);
  const mobileSearchRef = React.useRef<HTMLInputElement>(null);
  const mobileTriggerRef = React.useRef<HTMLButtonElement>(null);
  const mobileDialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const saved = readPreferences();
    if (typeof saved.desktopOpen === 'boolean') setDesktopOpen(saved.desktopOpen);
  }, []);

  React.useEffect(() => {
    setSheetOpen(false);
    setQuery('');
  }, [pathname]);

  React.useEffect(() => {
    const saved = readPreferences();
    setPinned((saved.pinned ?? []).filter((item) => {
      if (!item || typeof item.href !== 'string' || typeof item.label !== 'string') return false;
      if (!item.href.startsWith('/') || item.href.startsWith('//') || item.href.length > 500 || item.label.length > 80) return false;
      return canAccessActionLink(item, { isStaff, isFinanceStaff, isAdmin });
    }).slice(-8));
  }, [isStaff, isFinanceStaff, isAdmin]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (sheetOpen && event.key === 'Escape' && !event.isComposing) {
        setSheetOpen(false);
        window.requestAnimationFrame(() => mobileTriggerRef.current?.focus());
      }
      if (sheetOpen && event.key === 'Tab') {
        const dialog = mobileDialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.getClientRects().length > 0);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!dialog.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen]);

  React.useEffect(() => {
    if (!sheetOpen) return;
    const frame = window.requestAnimationFrame(() => mobileSearchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [sheetOpen]);

  if (!panel) return null;

  const tabs = (Object.keys(TAB_META) as ActionCenterTab[]).filter((tab) => panel.sections.some((section) => section.tab === tab));
  const selectedTab = tabs.includes(activeTab) ? activeTab : tabs[0];
  const selectedSections = panel.sections.filter((section) => section.tab === selectedTab);

  const togglePin = (item: ActionCenterLink) => {
    setPinned((current) => {
      const exists = current.some((candidate) => candidate.href === item.href);
      const next = exists ? current.filter((candidate) => candidate.href !== item.href) : [...current, item].slice(-8);
      const saved = readPreferences();
      writePreferences({ ...saved, pinned: next });
      return next;
    });
  };

  const toggleDesktop = () => {
    setDesktopOpen((current) => {
      const next = !current;
      const saved = readPreferences();
      writePreferences({ ...saved, desktopOpen: next });
      return next;
    });
  };

  const body = (idPrefix: string, searchRef: React.RefObject<HTMLInputElement | null>) => (
    <>
      <AttentionList items={attention} idPrefix={idPrefix} onNavigate={() => setSheetOpen(false)} />
      <div className="border-b border-gray-100 px-3 pb-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find an action or report"
            className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-[12px] text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-200"
            aria-label="Search Action Center"
          />
        </div>
      </div>
      <div className="border-b border-gray-100 px-3 py-2">
        <div className="grid grid-flow-col auto-cols-fr gap-1 rounded-lg bg-gray-100 p-1" aria-label="Action Center sections">
          {tabs.map((tab) => {
            const Icon = TAB_META[tab].icon;
            const count = panel.sections.filter((section) => section.tab === tab).reduce((sum, section) => sum + section.links.length, 0);
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={selectedTab === tab}
                onClick={() => setActiveTab(tab)}
                className={selectedTab === tab
                  ? 'flex h-8 items-center justify-center gap-1.5 rounded-md bg-white px-2 text-[11px] font-semibold text-gray-900 shadow-sm'
                  : 'flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-gray-500 hover:text-gray-800'}
              >
                <Icon className="h-3.5 w-3.5" />
                {TAB_META[tab].label}
                <span className="tabular-nums text-[10px] text-gray-400">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      {selectedTab === 'work' && pinned.length > 0 && !query ? (
        <div className="border-b border-gray-100 bg-amber-50/40 px-3 py-3">
          <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">
            <Pin className="h-3 w-3 fill-current" /> Pinned shortcuts
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pinned.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSheetOpen(false)}
                className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-900 shadow-sm hover:border-amber-300"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        <ActionCenterBody
          sections={selectedSections}
          idPrefix={idPrefix}
          query={query}
          pinned={pinned}
          onTogglePin={togglePin}
          onNavigate={() => setSheetOpen(false)}
        />
      </div>
    </>
  );

  return (
    <>
      <aside
        className={`hidden h-screen flex-shrink-0 flex-col overflow-hidden border-l border-gray-200/80 bg-[#fbfbfc] print:hidden xl:flex ${desktopOpen ? 'w-[304px]' : 'w-12'} transition-[width] duration-200`}
        aria-label="Action Center"
      >
        <div className={`flex h-14 flex-shrink-0 items-center border-b border-gray-100 ${desktopOpen ? 'justify-between px-4' : 'justify-center px-1'}`}>
          {desktopOpen ? (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-950"><Sparkles className="h-3.5 w-3.5" /> Action Center</div>
              <div className="truncate text-[10px] text-gray-400">{panel.label}</div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggleDesktop}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            aria-label={desktopOpen ? 'Collapse Action Center' : 'Expand Action Center'}
            title={`${desktopOpen ? 'Collapse' : 'Expand'} Action Center`}
          >
            {desktopOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
        {desktopOpen ? body('desktop-action-center', desktopSearchRef) : (
          <button type="button" onClick={toggleDesktop} className="mt-3 flex flex-col items-center gap-2 py-3 text-gray-400 hover:text-gray-800" aria-label="Expand Action Center">
            <Sparkles className="h-4 w-4" />
            <span className="[writing-mode:vertical-rl] text-[10px] font-semibold uppercase tracking-[0.12em]">Actions</span>
          </button>
        )}
      </aside>

      <button
        ref={mobileTriggerRef}
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-40 flex h-11 items-center gap-2 rounded-full bg-gray-950 px-4 text-white shadow-lg transition-transform active:scale-95 xl:hidden"
        aria-label="Open Action Center"
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-xs font-semibold">Actions</span>
      </button>

      {sheetOpen ? (
        <div ref={mobileDialogRef} className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label={`${panel.label} Action Center`}>
          <button type="button" tabIndex={-1} className="absolute inset-0 bg-black/35" onClick={() => { setSheetOpen(false); mobileTriggerRef.current?.focus(); }} aria-label="Close Action Center" />
          <div className="absolute inset-y-0 right-0 flex w-[340px] max-w-[92vw] flex-col bg-[#fbfbfc] shadow-2xl">
            <div className="flex h-14 flex-shrink-0 items-center justify-between border-b border-gray-100 px-4">
              <div>
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-950"><Sparkles className="h-3.5 w-3.5" /> Action Center</div>
                <div className="text-[10px] text-gray-400">{panel.label}</div>
              </div>
              <button
                type="button"
                onClick={() => { setSheetOpen(false); mobileTriggerRef.current?.focus(); }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                aria-label="Close Action Center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {body('mobile-action-center', mobileSearchRef)}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function TasksRail(props: TasksRailProps) {
  return (
    <React.Suspense fallback={null}>
      <TasksRailInner {...props} />
    </React.Suspense>
  );
}
