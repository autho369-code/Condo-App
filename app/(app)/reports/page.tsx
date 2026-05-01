// Reports index — matches AppFolio's categorized flat-grid layout.
// Reads: public.report_definitions (all 48 active reports) + public.saved_reports
// (per-portfolio presets, with pinned = "favorite"). RLS scopes both.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ContextPanel, PanelSection, PanelLink } from '@/components/workspace/context-panel';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// AppFolio's UI groups → our report_definitions.slug values.
// Our DB category enum has 7 values but AppFolio presents 8 display groups,
// so we map at the UI layer. Any slug not listed here falls through to "Other".
// ---------------------------------------------------------------------------
const UI_GROUPS: Array<{ title: string; slugs: string[] }> = [
  {
    title: 'Accounting Reports',
    slugs: [
      'balance_sheet', 'income_statement', 'cash_flow', 'general_ledger', 'trial_balance',
      'annual_budget_comparative', 'budget_vs_actual', 'fund_balance_sheet',
      'reserve_fund_analysis', 'bank_reconciliation',
    ],
  },
  {
    title: 'Association Reports',
    slugs: [
      'assessment_roll', 'delinquency', 'dues_roll', 'owner_ledger',
      'owner_vehicle_info', 'owner_directory',
    ],
  },
  {
    title: 'Diagnostic Reports',
    slugs: ['data_diagnostics_summary', 'email_delivery_errors', 'users_and_permissions', 'violation_log'],
  },
  {
    title: 'Maintenance Reports',
    slugs: ['open_work_orders', 'maintenance_history', 'work_order_report',
            'vendor_performance', 'project_directory', 'purchase_order_detail'],
  },
  {
    title: 'Property And Unit Reports',
    slugs: ['property_directory', 'unit_availability', 'unit_turn_report', 'vendor_directory'],
  },
  {
    title: 'Tax Reports',
    slugs: ['owner_1099_detail', 'owner_1099_summary', 'vendor_1099_detail', 'vendor_1099_summary'],
  },
  {
    title: 'Transaction Reports',
    slugs: [
      'ap_aging', 'ar_aging', 'aged_payables_summary', 'bill_detail', 'charge_detail',
      'check_register', 'deposit_register', 'expense_register', 'income_register',
      'journal_entry_register', 'unpaid_balances_by_month',
    ],
  },
  {
    title: 'Communication Reports',
    slugs: ['letter_history', 'survey_results'],
  },
];

type Def = { id: string; slug: string; name: string; description: string | null; category: string };
type Saved = {
  id: string;
  name: string;
  pinned: boolean;
  last_run_at: string | null;
  run_count: number | null;
  created_at: string;
  definition_id: string;
  report_definitions: { slug: string; name: string } | null;
  profiles: { full_name: string | null } | null;
};

export default async function ReportsIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const supabase = await createClient();

  const [{ data: defs }, { data: saved }] = await Promise.all([
    supabase.from('report_definitions')
      .select('id, slug, name, description, category')
      .eq('active', true)
      .order('name'),
    supabase.from('saved_reports')
      .select(`
        id, name, pinned, last_run_at, run_count, created_at, definition_id,
        report_definitions(slug, name),
        profiles(full_name)
      `)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  const allDefs = (defs ?? []) as Def[];
  const savedRows = (saved ?? []) as unknown as Saved[];

  // Search filter (applies to definitions only — AppFolio filters saved with its own logic)
  const term = q.trim().toLowerCase();
  const match = (d: Def) =>
    !term ||
    d.name.toLowerCase().includes(term) ||
    (d.description ?? '').toLowerCase().includes(term) ||
    d.slug.toLowerCase().includes(term);

  // Group definitions by UI group
  const bySlug = new Map(allDefs.map((d) => [d.slug, d]));
  const groups = UI_GROUPS.map((g) => ({
    title: g.title,
    items: g.slugs.map((s) => bySlug.get(s)).filter((d): d is Def => !!d && match(d)),
  })).filter((g) => g.items.length > 0);

  // Anything in DB that didn't match a UI group lands in "Other"
  const usedSlugs = new Set(UI_GROUPS.flatMap((g) => g.slugs));
  const orphans = allDefs.filter((d) => !usedSlugs.has(d.slug) && match(d));
  if (orphans.length > 0) groups.push({ title: 'Other Reports', items: orphans });

  // Favorites: saved reports where pinned = true (sorted first already)
  const favorites = savedRows.filter((s) => s.pinned);

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
      {/* Top bar */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-8 py-5">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
            <Link
              href="/reports/builder"
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Report Builder
            </Link>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-8 py-4">
          <form action="/reports" method="get" className="relative">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search reports by name, description, or column"
              className="h-10 w-full rounded border border-gray-300 bg-white pl-4 pr-10 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:bg-gray-100"
              aria-label="Search"
            >
              <SearchIcon />
            </button>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-8 py-6 space-y-4">
        {/* Favorites */}
        {favorites.length > 0 && (
          <Section title="Favorite Reports" count={favorites.length} defaultOpen>
            <SavedGrid rows={favorites} compact />
          </Section>
        )}

        {/* Category sections */}
        {groups.map((g) => (
          <Section key={g.title} title={g.title} count={g.items.length} defaultOpen={!!term}>
            <div className="grid grid-cols-1 gap-x-8 gap-y-0 px-4 py-2 sm:grid-cols-2 md:grid-cols-3">
              {g.items.map((d) => (
                <ReportRow key={d.id} def={d} />
              ))}
            </div>
          </Section>
        ))}

        {/* Saved Reports */}
        {savedRows.length > 0 && (
          <Section title="Saved Reports" count={savedRows.length} defaultOpen>
            <SavedGrid rows={savedRows} />
          </Section>
        )}

        {groups.length === 0 && favorites.length === 0 && (
          <div className="rounded border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
            No reports match &quot;{q}&quot;.
          </div>
        )}
      </div>
      </div>

      <ContextPanel>
        <PanelSection title="Tasks">
          <PanelLink href="/reports/runs">Run history</PanelLink>
          <PanelLink href="/scheduled-reports">Scheduled reports</PanelLink>
          <PanelLink href="/reports/ar_aging">A/R Aging (live)</PanelLink>
        </PanelSection>
        <PanelSection title="Jump to category">
          <PanelLink href="/reports?q=accounting">Accounting</PanelLink>
          <PanelLink href="/reports?q=association">Association</PanelLink>
          <PanelLink href="/reports?q=maintenance">Maintenance</PanelLink>
          <PanelLink href="/reports?q=tax">Tax</PanelLink>
          <PanelLink href="/reports?q=transaction">Transaction</PanelLink>
        </PanelSection>
        <PanelSection title="Help Topics">
          <PanelLink href="#">Scheduling a report</PanelLink>
          <PanelLink href="#">Saving a report preset</PanelLink>
          <PanelLink href="#">Report builder basics</PanelLink>
        </PanelSection>
      </ContextPanel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible section — uses <details> so no client JS is needed.
// ---------------------------------------------------------------------------
function Section({
  title, count, defaultOpen = false, children,
}: {
  title: string; count: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  return (
    <details
      {...(defaultOpen ? { open: true } : {})}
      className="rounded border border-gray-200 bg-white [&[open]_.chev]:rotate-90"
    >
      <summary className="flex cursor-pointer select-none items-center gap-2 border-b border-transparent px-4 py-3 [&::-webkit-details-marker]:hidden [details[open]>&]:border-gray-100">
        <span className="chev inline-block text-gray-500 transition-transform">▸</span>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <span className="text-xs tabular-nums text-gray-400">({count})</span>
      </summary>
      <div>{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Single report row in the category grid.
// Matches AppFolio: blue link + star (non-functional visual) + chevron.
// ---------------------------------------------------------------------------
function ReportRow({ def }: { def: Def }) {
  return (
    <div className="group flex items-center justify-between py-1.5 text-sm">
      <Link
        href={`/reports/${def.slug}`}
        title={def.description ?? undefined}
        className="min-w-0 flex-1 truncate text-blue-700 hover:underline"
      >
        {def.name}
      </Link>
      <div className="ml-2 flex shrink-0 items-center gap-1 text-gray-300">
        <StarIcon className="hover:text-amber-400" />
        <ChevronIcon className="hover:text-gray-600" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved reports list — uses different row style that matches AppFolio's
// "Copy of X | Created by: Y" format.
// ---------------------------------------------------------------------------
function SavedGrid({ rows, compact = false }: { rows: Saved[]; compact?: boolean }) {
  return (
    <div className="divide-y divide-gray-100">
      {rows.map((s) => {
        const slug = s.report_definitions?.slug ?? '';
        const displayName = s.name || s.report_definitions?.name || 'Untitled';
        return (
          <div key={s.id} className={'flex items-center justify-between px-4 ' + (compact ? 'py-1.5' : 'py-2')}>
            <Link
              href={slug ? `/reports/${slug}?saved=${s.id}` : '#'}
              className="min-w-0 flex-1 truncate text-sm text-blue-700 hover:underline"
            >
              {displayName}
            </Link>
            <div className="ml-4 flex shrink-0 items-center gap-4">
              <span className="whitespace-nowrap text-xs text-gray-500">
                Created by: <span className="text-gray-700">{s.profiles?.full_name ?? 'Unknown'}</span>
              </span>
              {s.last_run_at && (
                <span className="hidden whitespace-nowrap text-xs text-gray-400 md:inline">
                  Last run {date(s.last_run_at)}
                </span>
              )}
              <div className="flex items-center gap-1 text-gray-300">
                <StarIcon filled={s.pinned} className={s.pinned ? 'text-amber-400' : 'hover:text-amber-400'} />
                <ChevronIcon className="hover:text-gray-600" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVGs (no icon lib dependency).
// ---------------------------------------------------------------------------
function StarIcon({ filled = false, className = '' }: { filled?: boolean; className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}
function ChevronIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
