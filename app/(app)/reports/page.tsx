import Link from 'next/link';
import type { ReactNode } from 'react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { filterReports, type ReportDefinition } from '@/lib/reports/catalog';
import { deleteSavedReport, toggleReportFavorite, toggleSavedReportPin } from '@/lib/rpcs/reports';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ── Spec §4 report categories with AppFolio-aligned labels ──
const SPEC_CATEGORIES: Record<string, { label: string; order: number }> = {
  accounting:    { label: 'Accounting Reports',   order: 1 },
  association:   { label: 'Association Reports',  order: 2 },
  maintenance:   { label: 'Maintenance Reports',  order: 3 },
  tax:           { label: 'Tax Reports',          order: 4 },
  transaction:   { label: 'Transaction Reports',  order: 5 },
};

// ── AppFolio §4.1 canonical report names → preferred category ──
const CANONICAL_REPORTS: Record<string, { name: string; description: string; category: string }> = {
  balance_sheet:          { name: 'Balance Sheet',           description: 'Assets, liabilities, and equity snapshot',                    category: 'accounting' },
  cash_flow:              { name: 'Cash Flow',               description: 'Operating, investing, and financing cash movements',          category: 'accounting' },
  general_ledger:         { name: 'General Ledger',          description: 'Complete transaction register with running balances',          category: 'accounting' },
  income_statement:       { name: 'Income Statement',        description: 'Revenue and expenses over a selected period',                  category: 'accounting' },
  trial_balance:          { name: 'Trial Balance',           description: 'Debit and credit summary for all GL accounts',                category: 'accounting' },
  trust_account_balance:  { name: 'Trust Account Balance',   description: 'Reconciliation-ready trust / escrow account snapshot',          category: 'accounting' },
  dues_roll:              { name: 'Dues Roll',               description: 'Assessment status for every unit in the association',           category: 'association' },
  violation_detail:       { name: 'Violation Detail',        description: 'All open and recently-closed violation cases',                 category: 'maintenance' },
  inspection_detail:      { name: 'Inspection Detail',       description: 'Scheduled and completed property inspections',                  category: 'maintenance' },
  work_order_billable:    { name: 'Work Order Billable',     description: 'Billable maintenance work orders with cost tracking',           category: 'maintenance' },
  form_1099_detail:       { name: '1099 Detail',             description: 'Vendor payments reportable on Form 1099-NEC / 1099-MISC',      category: 'tax' },
  aged_payables:          { name: 'Aged Payables',           description: 'Outstanding bills by aging bucket',                            category: 'accounting' },
  check_register:         { name: 'Check Register',          description: 'All checks issued with payee, amount, and date',               category: 'transaction' },
  expense_register:       { name: 'Expense Register',        description: 'Every expense coded to GL account and association',            category: 'transaction' },
  journal_entry_register: { name: 'Journal Entry Register',  description: 'Manual and recurring journal entries with audit trail',         category: 'transaction' },
};

type SavedReport = {
  id: string;
  name: string;
  pinned: boolean;
  last_run_at: string | null;
  run_count: number | null;
  created_at: string;
  user_id: string | null;
  parameters: Record<string, unknown> | null;
  report_definitions: { slug: string; name: string } | null;
  creator_name?: string | null;
};

const TABS = [
  { key: 'all', label: 'All Reports' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'custom', label: 'Custom Reports' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default async function ReportsIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; tab?: string; saved_report?: string; deleted?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const tab: TabKey = (TABS.some((t) => t.key === sp.tab) ? sp.tab : 'all') as TabKey;
  const supabase = await createClient();
  const db = supabase as any;

  const [defsResult, savedResult, { data: favoriteRows, error: favoriteError }] = await Promise.all([
    fetchAllRows<any>(() => db.from('report_definitions')
      .select('id, slug, name, description, category, active')
      .eq('active', true)
      .order('name')
      .order('id')),
    fetchAllRows<any>(() => db.from('saved_reports')
      .select('id, name, pinned, last_run_at, run_count, created_at, user_id, parameters, report_definitions(slug, name)')
      .order('name')
      .order('id')),
    // RLS returns only the signed-in user's own favorites.
    db.from('report_favorites').select('definition_id'),
  ]);
  const loadError = defsResult.error ?? savedResult.error ?? favoriteError?.message ?? null;

  const definitions = defsResult.rows as ReportDefinition[];
  const savedRows = savedResult.rows as SavedReport[];
  const favoriteIds = new Set<string>(((favoriteRows ?? []) as any[]).map((r) => r.definition_id));

  // saved_reports.user_id has no FK to profiles, so PostgREST can't embed it —
  // resolve creator names with a second lookup instead.
  const creatorIds = [...new Set(savedRows.map((r) => r.user_id).filter(Boolean))] as string[];
  if (creatorIds.length > 0) {
    const { data: creators } = await db
      .from('profiles')
      .select('id, full_name')
      .in('id', creatorIds);
    const nameById = new Map<string, string | null>(
      ((creators ?? []) as { id: string; full_name: string | null }[]).map((c) => [c.id, c.full_name])
    );
    for (const row of savedRows) {
      row.creator_name = row.user_id ? nameById.get(row.user_id) ?? null : null;
    }
  }

  // Enrich DB definitions with canonical names/descriptions when they match
  const enriched = definitions.map((d) => {
    const canonical = CANONICAL_REPORTS[d.slug];
    return {
      ...d,
      displayName: canonical?.name ?? d.name,
      displayDescription: canonical?.description ?? d.description ?? '',
      specCategory: canonical?.category ?? d.category,
    };
  });
  const matches = new Set(filterReports(definitions, q).map((d) => d.id));
  const ql = q.toLowerCase();
  const visible = enriched.filter((d) => matches.has(d.id) || d.displayName.toLowerCase().includes(ql))
    .filter((d) => tab !== 'favorites' || favoriteIds.has(d.id));
  const visibleSaved = savedRows
    .filter((r) => tab === 'custom' || (tab === 'favorites' && r.pinned))
    .filter((r) => !ql || (r.name ?? '').toLowerCase().includes(ql) || (r.report_definitions?.name ?? '').toLowerCase().includes(ql));

  const groupedBySpec = new Map<string, typeof visible>();
  for (const def of tab === 'custom' ? [] : visible) {
    const list = groupedBySpec.get(def.specCategory) ?? [];
    list.push(def);
    groupedBySpec.set(def.specCategory, list);
  }
  const sortedCategories = Array.from(groupedBySpec.entries())
    .sort(([a], [b]) => (SPEC_CATEGORIES[a]?.order ?? 99) - (SPEC_CATEGORIES[b]?.order ?? 99) || a.localeCompare(b))
    .map(([key, items]) => [key, items.sort((x, y) => x.displayName.localeCompare(y.displayName))] as const);

  const tabHref = (key: TabKey) => {
    const p = new URLSearchParams();
    if (key !== 'all') p.set('tab', key);
    if (q) p.set('q', q);
    return p.toString() ? `/reports?${p}` : '/reports';
  };
  const returnTo = tabHref(tab);
  const pinnedCount = savedRows.filter((r) => r.pinned).length;
  const counts: Record<TabKey, number> = {
    all: definitions.length,
    favorites: favoriteIds.size + pinnedCount,
    custom: savedRows.length,
  };
  const nothing = sortedCategories.length === 0 && visibleSaved.length === 0;

  return (
    <DataWorkspace
      title="Reports"
      description="Find a report by name or category, star the ones you use most, and save reports with their filters as custom reports."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/reports/runs"><Button variant="secondary">Report history</Button></Link>
          <Link href="/reports/monthly-package"><Button>Monthly package</Button></Link>
        </div>
      }
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Something went wrong">{sp.error}</Alert>}
        {loadError && <Alert tone="danger" title="Could not load every report">{loadError}</Alert>}
        {sp.saved_report && <Alert tone="success">Custom report saved.</Alert>}
        {sp.deleted && <Alert tone="success">Custom report deleted.</Alert>}

        <nav className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${tab === t.key ? 'border-gray-950 text-gray-950' : 'border-transparent text-gray-500 transition-colors hover:text-gray-700'}`}
            >
              {t.label} <span className="ml-1 tabular-nums text-gray-400">{counts[t.key]}</span>
            </Link>
          ))}
        </nav>

        <form action="/reports" method="get" className="flex flex-wrap items-center gap-2">
          {tab !== 'all' && <input type="hidden" name="tab" value={tab} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Find a report"
            aria-label="Find a report"
            className="h-10 min-w-0 flex-1 basis-64 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>

        {visibleSaved.length > 0 && (
          <ReportSection title={tab === 'favorites' ? 'Pinned custom reports' : 'Custom reports'} count={visibleSaved.length}>
            <SavedReports rows={visibleSaved} returnTo={returnTo} />
          </ReportSection>
        )}

        {sortedCategories.map(([catKey, items]) => (
          <ReportSection
            key={catKey}
            title={SPEC_CATEGORIES[catKey]?.label ?? `${catKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} Reports`}
            count={items.length}
          >
            <ul className="divide-y divide-gray-100">
              {items.map((definition) => {
                const starred = favoriteIds.has(definition.id);
                return (
                  <li key={definition.id} className="flex items-start gap-2 px-2 py-1.5 sm:px-3">
                    <form action={toggleReportFavorite}>
                      <input type="hidden" name="definition_id" value={definition.id} />
                      <input type="hidden" name="favorite" value={starred ? '0' : '1'} />
                      <input type="hidden" name="return_to" value={returnTo} />
                      <button
                        type="submit"
                        aria-label={starred ? `Remove ${definition.displayName} from favorites` : `Add ${definition.displayName} to favorites`}
                        title={starred ? 'Remove from favorites' : 'Add to favorites'}
                        className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors hover:bg-gray-100 ${starred ? 'text-amber-500' : 'text-gray-300 hover:text-gray-500'}`}
                      >
                        {starred ? '\u2605' : '\u2606'}
                      </button>
                    </form>
                    <Link href={`/reports/${definition.slug}`} className="min-w-0 flex-1 rounded-lg px-1 py-2 hover:bg-gray-50">
                      <div className="text-sm font-medium text-gray-900">{definition.displayName}</div>
                      {definition.displayDescription && (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-gray-500">{definition.displayDescription}</p>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </ReportSection>
        ))}

        {nothing && (
          <div className="rounded-2xl border border-gray-200/70 bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {q
              ? <>No reports match &quot;{q}&quot;.</>
              : tab === 'favorites'
                ? 'No favorites yet. Star a report to keep it here.'
                : tab === 'custom'
                  ? 'No custom reports yet. Open a report, set its filters, and use Save as custom report.'
                  : 'No reports available.'}
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

// ═══════════════════════════════════════════════════════════════
// Shared UI components
// ═══════════════════════════════════════════════════════════════
function ReportSection({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle?: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function SavedReports({ rows, returnTo }: { rows: SavedReport[]; returnTo: string }) {
  return (
    <div className="divide-y divide-gray-100">
      {rows.map((report) => {
        const slug = report.report_definitions?.slug;
        return (
          <div key={report.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <Link
                href={slug ? `/reports/${slug}?saved=${report.id}` : '/reports'}
                className="truncate text-sm font-medium text-gray-900 hover:text-gray-950 hover:underline"
              >
                {report.name || report.report_definitions?.name || 'Untitled report'}
              </Link>
              <p className="mt-1 text-xs text-gray-500">
                {report.report_definitions?.name ?? 'Report'}
                {' · '}Created by {report.creator_name ?? 'Unknown'} on {date(report.created_at)}
                {report.last_run_at ? ` · last run ${date(report.last_run_at)}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <form action={toggleSavedReportPin}>
                <input type="hidden" name="saved_report_id" value={report.id} />
                <input type="hidden" name="pinned" value={report.pinned ? '0' : '1'} />
                <input type="hidden" name="return_to" value={returnTo} />
                <Button type="submit" variant="secondary" size="sm">{report.pinned ? 'Unpin from favorites' : 'Pin to favorites'}</Button>
              </form>
              <form action={deleteSavedReport}>
                <input type="hidden" name="saved_report_id" value={report.id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <Button type="submit" variant="secondary" size="sm">Delete</Button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}
