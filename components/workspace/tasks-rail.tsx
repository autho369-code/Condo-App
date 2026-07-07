'use client';

/* ────────────────────────────────────────────────────────────────────────
   TasksRail — route-aware right panel (AppFolio-style Tasks / Reports /
   Help), restored as a single global component.
   · ≥1280px (xl): fixed right rail, collapsible, preference remembered
   · <1280px: floating button opens a slide-over sheet
   Every href below is a real route — no placeholders.
   ──────────────────────────────────────────────────────────────────────── */

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ClipboardList, X, Star, BarChart3, ChevronRight, PanelRightClose, PanelRightOpen,
} from 'lucide-react';

type PanelLink = { label: string; href: string };
type PanelSection = { title: string; icon?: 'tasks' | 'reports'; links: PanelLink[] };
type PanelDef = {
  match: RegExp;
  sections?: PanelSection[];
  // For route families whose panel depends on the URL (record id, ?view= tab)
  build?: (pathname: string, view: string) => PanelSection[];
};

const PANELS: PanelDef[] = [
  {
    match: /^\/associations\/[^/]+\/board/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'New approval', href: '/associations' },
        { label: 'Send email', href: '/send-email' },
      ]},
      { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
    ],
  },
  {
    match: /^\/associations\/[^/]+/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'New unit', href: '/units/new' },
        { label: 'New owner', href: '/owners/new' },
        { label: 'New work order', href: '/maintenance/new' },
        { label: 'New violation', href: '/violations/new' },
        { label: 'New meeting', href: '/meetings/new' },
        { label: 'Send email', href: '/send-email' },
      ]},
      { title: 'Reports', icon: 'reports', links: [
        { label: 'All reports', href: '/reports' },
        { label: 'Budget vs actuals', href: '/budget-vs-actuals' },
      ]},
    ],
  },
  {
    match: /^\/associations/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'New association', href: '/associations/new' },
        { label: 'New building', href: '/buildings/new' },
        { label: 'New unit', href: '/units/new' },
      ]},
      { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
    ],
  },
  {
    match: /^\/(bank-accounts|bank-transfers|journal-entries|gl-accounts|charges|bills|budget|diagnostics)/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'New bank account', href: '/bank-accounts/new' },
        { label: 'Record deposit', href: '/bank-accounts/deposits/new' },
        { label: 'Reconcile account', href: '/bank-accounts/reconcile/new' },
        { label: 'Bank adjustment', href: '/bank-accounts/adjustments/new' },
        { label: 'New bill', href: '/bills/new' },
        { label: 'Owner payable', href: '/bills/owner-payable/new' },
        { label: 'New budget', href: '/budget/new' },
      ]},
      { title: 'Reports', icon: 'reports', links: [
        { label: 'All reports', href: '/reports' },
        { label: 'Budget vs actuals', href: '/budget-vs-actuals' },
        { label: 'Diagnostics', href: '/diagnostics' },
      ]},
    ],
  },
  {
    match: /^\/(work-orders|maintenance)/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'New work order', href: '/maintenance/new' },
        { label: 'Maintenance comms', href: '/maintenance/communications' },
      ]},
      { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
    ],
  },
  {
    // Individual owner record — actions scoped to this owner
    match: /^\/owners\/[0-9a-f]{8}-[0-9a-f-]+$/,
    build: (pathname) => {
      const ownerId = pathname.split('/')[2];
      return [
        { title: 'Tasks', icon: 'tasks', links: [
          { label: 'Record charge', href: '/charges/new' },
          { label: 'Receivables for this owner', href: `/charges?owner=${ownerId}` },
          { label: 'Send statement', href: `/owners/${ownerId}?view=statements` },
          { label: 'Owner payable / refund', href: '/bills/owner-payable/new' },
          { label: 'Manage portal access', href: `/owners/${ownerId}#portal-access` },
          { label: 'Management agreement', href: `/owners/management-agreements?owner=${ownerId}` },
          { label: 'Send email', href: '/send-email' },
        ]},
        { title: 'Reports', icon: 'reports', links: [
          { label: 'Owner ledger', href: '/reports/homeowner_ledger' },
          { label: 'Delinquency', href: '/reports/delinquency' },
          { label: 'All reports', href: '/reports' },
        ]},
      ];
    },
  },
  {
    match: /^\/owners/,
    build: (_pathname, view) => {
      if (view === 'tenants') {
        return [
          { title: 'Tasks', icon: 'tasks', links: [
            { label: 'Add tenant (via owner record)', href: '/owners' },
            { label: 'Export leases (CSV)', href: '/owners/leases/export' },
            { label: 'Lease renewal notice', href: '/send-email' },
          ]},
          { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
        ];
      }
      if (view === 'directory') {
        return [
          { title: 'Tasks', icon: 'tasks', links: [
            { label: 'New owner', href: '/owners/new' },
            { label: 'Send owner form', href: '/owners/forms' },
            { label: 'Send announcement', href: '/communication-center' },
          ]},
          { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
        ];
      }
      return [
        { title: 'Tasks', icon: 'tasks', links: [
          { label: 'New owner', href: '/owners/new' },
          { label: 'Management agreement', href: '/owners/management-agreements/new' },
          { label: 'Send email', href: '/send-email' },
          { label: 'Statement settings', href: '/bulk-statement-settings/new' },
        ]},
        { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
      ];
    },
  },
  {
    match: /^\/vendors/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'New vendor', href: '/vendors/new' },
        { label: 'New work order', href: '/maintenance/new' },
        { label: 'New bill', href: '/bills/new' },
      ]},
      { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
    ],
  },
  {
    match: /^\/(violations)/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'New violation', href: '/violations/new' },
        { label: 'Send letter', href: '/letters/new' },
      ]},
      { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
    ],
  },
  {
    match: /^\/meetings/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'New meeting', href: '/meetings/new' },
        { label: 'Minutes & sign-in (open a meeting)', href: '/meetings' },
        { label: 'Send meeting notice', href: '/send-email' },
      ]},
      { title: 'Reports', icon: 'reports', links: [
        { label: 'Board packet', href: '/reports/board_packet' },
        { label: 'All reports', href: '/reports' },
      ]},
    ],
  },
  {
    match: /^\/calendar/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'New event', href: '/calendar/new' },
        { label: 'New meeting', href: '/meetings/new' },
      ]},
    ],
  },
  {
    match: /^\/architectural-reviews/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'Review queue', href: '/architectural-reviews' },
        { label: 'Send decision letter', href: '/letters/new' },
        { label: 'Email the owner', href: '/send-email' },
      ]},
      { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
    ],
  },
  {
    match: /^\/amenities/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'Manage reservations', href: '/amenities' },
        { label: 'Bookable amenities (by association)', href: '/associations' },
        { label: 'Send amenity notice', href: '/send-email' },
      ]},
      { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
    ],
  },
  {
    match: /^\/lock-boxes/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'Add lock box', href: '/lock-boxes/new' },
        { label: 'Active assignments', href: '/lock-boxes?tab=assignments' },
        { label: 'Key inventory', href: '/lock-boxes?tab=keys' },
      ]},
      { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
    ],
  },
  {
    match: /^\/(communication-center|surveys)/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'Compose email', href: '/send-email' },
        { label: 'Send SMS', href: '/sms' },
        { label: 'New letter', href: '/letters/new' },
        { label: 'Review drafts', href: '/communication-center' },
        { label: 'Surveys', href: '/surveys' },
      ]},
      { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
    ],
  },
  {
    match: /^\/(insurance)/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [{ label: 'New policy', href: '/insurance/new' }] },
      { title: 'Reports', icon: 'reports', links: [{ label: 'All reports', href: '/reports' }] },
    ],
  },
  {
    match: /^\/(documents|letters|sms|send-email|inbox)/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'Generate document', href: '/documents/generate' },
        { label: 'New template', href: '/documents/templates/new' },
        { label: 'New letter', href: '/letters/new' },
        { label: 'New SMS template', href: '/sms/templates/new' },
      ]},
    ],
  },
  {
    match: /^\/dashboard/,
    sections: [
      { title: 'Tasks', icon: 'tasks', links: [
        { label: 'New work order', href: '/maintenance/new' },
        { label: 'New violation', href: '/violations/new' },
        { label: 'New event', href: '/calendar/new' },
        { label: 'Send email', href: '/send-email' },
      ]},
      { title: 'Reports', icon: 'reports', links: [
        { label: 'All reports', href: '/reports' },
        { label: 'Budget vs actuals', href: '/budget-vs-actuals' },
      ]},
    ],
  },
];

function panelFor(pathname: string, view: string): PanelSection[] | null {
  for (const p of PANELS) {
    if (p.match.test(pathname)) return p.build ? p.build(pathname, view) : (p.sections ?? null);
  }
  return null;
}

function SectionBlock({ section }: { section: PanelSection }) {
  const Icon = section.icon === 'reports' ? BarChart3 : Star;
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
        <Icon className="h-3 w-3" /> {section.title}
      </div>
      <ul className="space-y-0.5">
        {section.links.map((l) => (
          <li key={l.href + l.label}>
            <Link
              href={l.href}
              className="group flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-950"
            >
              {l.label}
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TasksRailInner() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const view = searchParams?.get('view') ?? '';
  const sections = panelFor(pathname, view);
  const [desktopOpen, setDesktopOpen] = React.useState(true);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem('p369.tasksRail');
      if (saved !== null) setDesktopOpen(saved === '1');
    } catch {}
  }, []);
  React.useEffect(() => {
    setSheetOpen(false); // close sheet on navigation
  }, [pathname]);

  if (!sections) return null;

  const body = (
    <div className="space-y-5 px-4 py-4">
      {sections.map((s, i) => <SectionBlock key={i} section={s} />)}
    </div>
  );

  return (
    <>
      {/* Desktop rail (xl+) */}
      <aside
        className={
          'hidden xl:flex h-screen flex-shrink-0 flex-col overflow-hidden border-l border-gray-200/80 bg-white transition-[width] duration-200 ' +
          (desktopOpen ? 'w-64' : 'w-11')
        }
        aria-label="Tasks panel"
      >
        <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-gray-100 px-3">
          {desktopOpen && <span className="text-[13px] font-semibold text-gray-950">Tasks</span>}
          <button
            onClick={() => {
              const next = !desktopOpen;
              setDesktopOpen(next);
              try { window.localStorage.setItem('p369.tasksRail', next ? '1' : '0'); } catch {}
            }}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label={desktopOpen ? 'Collapse tasks panel' : 'Expand tasks panel'}
          >
            {desktopOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
        {desktopOpen && <div className="flex-1 overflow-y-auto">{body}</div>}
      </aside>

      {/* Mobile / tablet: floating button + slide-over */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gray-950 text-white shadow-lg transition-transform active:scale-95 xl:hidden"
        aria-label="Open tasks panel"
      >
        <ClipboardList className="h-5 w-5" />
      </button>
      {sheetOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Tasks panel">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSheetOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[300px] max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-12 flex-shrink-0 items-center justify-between border-b border-gray-100 px-4">
              <span className="text-[13px] font-semibold text-gray-950">Tasks</span>
              <button onClick={() => setSheetOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close tasks panel">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{body}</div>
          </div>
        </div>
      )}
    </>
  );
}

// useSearchParams requires a Suspense boundary during prerender.
export default function TasksRail() {
  return (
    <React.Suspense fallback={null}>
      <TasksRailInner />
    </React.Suspense>
  );
}
