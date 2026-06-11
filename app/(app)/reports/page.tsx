import Link from 'next/link';
import type { ReactNode } from 'react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { filterReports, groupReports, type ReportDefinition } from '@/lib/reports/catalog';
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

  const [
    { data: defs },
    { data: saved },
    { count: activeCount },
    { count: scheduledCount },
  ] = await Promise.all([
    (supabase as any).from('report_definitions')
      .select('id, slug, name, description, category, active')
      .eq('active', true)
      .order('name'),
    (supabase as any).from('saved_reports')
      .select(`
        id, name, pinned, last_run_at, run_count, created_at,
        report_definitions(slug, name),
        profiles(full_name)
      `)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    (supabase as any).from('report_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('active', true),
    (supabase as any).from('scheduled_reports')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .eq('active', true),
  ]);

  const definitions = (defs ?? []) as ReportDefinition[];
  const visibleDefinitions = filterReports(definitions, q);
  const groups = groupReports(visibleDefinitions);
  const savedRows = (saved ?? []) as unknown as SavedReport[];
  const favorites = savedRows.filter((report) => report.pinned);

  // ── Build spec-category card grid ──
  // Enrich DB definitions with canonical names/descriptions when they match
  const enrichedDefinitions = visibleDefinitions.map((d) => {
    const canonical = CANONICAL_REPORTS[d.slug];
    return {
      ...d,
      displayName: canonical?.name ?? d.name,
      displayDescription: canonical?.description ?? d.description ?? 'Scoped report workspace',
      specCategory: canonical?.category ?? d.category,
    };
  });

  // Group by spec category, respecting order
  const groupedBySpec = new Map<string, typeof enrichedDefinitions>();
  for (const def of enrichedDefinitions) {
    const cat = def.specCategory;
    if (!groupedBySpec.has(cat)) groupedBySpec.set(cat, []);
    groupedBySpec.get(cat)!.push(def);
  }

  // Sort categories by spec order
  const sortedCategories = Array.from(groupedBySpec.entries()).sort(([a], [b]) => {
    const orderA = SPEC_CATEGORIES[a]?.order ?? 99;
    const orderB = SPEC_CATEGORIES[b]?.order ?? 99;
    return orderA - orderB;
  });

  return (
    <DataWorkspace
      title="Reports"
      description="Run accounting, association, maintenance, tax, and transaction reports from one workspace."
      actions={
        <form action="/reports" method="get" className="flex min-w-80 items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search reports"
            aria-label="Search reports"
            className="h-10 min-w-64 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      }
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            { label: 'Active catalog', value: activeCount ?? definitions.length, sublabel: 'Available report definitions' },
            { label: 'Visible results', value: enrichedDefinitions.length, sublabel: q ? `Filtered by "${q}"` : 'Current catalog view' },
            { label: 'Saved reports', value: savedRows.length, sublabel: `${favorites.length} pinned favorites` },
            { label: 'Scheduled runs', value: scheduledCount ?? 0, sublabel: <Link href="/reports/runs" className="font-medium text-gray-500 transition-colors hover:text-gray-900">View run history</Link> },
          ]}
        />

        {/* Favorites strip */}
        {favorites.length > 0 && (
          <ReportSection title="Pinned saved reports" count={favorites.length}>
            <SavedReports rows={favorites} />
          </ReportSection>
        )}

        {/* ── Card grid by spec category ── */}
        {sortedCategories.map(([catKey, items]) => {
          const catLabel = SPEC_CATEGORIES[catKey]?.label ?? catKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          return (
            <ReportSection key={catKey} title={catLabel} count={items.length}>
              <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((definition) => (
                  <Link
                    key={definition.id}
                    href={`/reports/${definition.slug}`}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
                  >
                    <div className="font-medium text-gray-900">{definition.displayName}</div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
                      {definition.displayDescription}
                    </p>
                  </Link>
                ))}
              </div>
            </ReportSection>
          );
        })}

        {/* ── Scheduled Reports section ── */}
        <ReportSection title="Scheduled Reports" subtitle="Automated, recurring report delivery" count={scheduledCount ?? 0}>
          <div className="px-4 py-4">
            {(scheduledCount ?? 0) > 0 ? (
              <p className="text-sm text-gray-600">
                {scheduledCount} report{(scheduledCount ?? 0) !== 1 ? 's' : ''} scheduled for automatic generation.
              </p>
            ) : (
              <p className="text-sm text-gray-500">No reports scheduled yet. Saved reports can be scheduled for recurring delivery.</p>
            )}
            <div className="mt-3">
              <Link href="/reports/runs" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950">
                View scheduled reports &rarr;
              </Link>
            </div>
          </div>
        </ReportSection>

        {/* ── Metrics section (system-level report KPIs) ── */}
        <ReportSection title="Metrics" subtitle="Report generation activity and performance" count={4}>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricTile label="Catalog size" value={definitions.length} sub="Report definitions" />
            <MetricTile label="Saved" value={savedRows.length} sub="User-saved reports" />
            <MetricTile label="Scheduled" value={scheduledCount ?? 0} sub="Active schedules" />
            <MetricTile label="Favorites" value={favorites.length} sub="Pinned reports" />
          </div>
        </ReportSection>

        {/* ── Surveys section ── */}
        <ReportSection title="Surveys" subtitle="Owner and community surveys" count={0}>
          <div className="px-4 py-4">
            <p className="text-sm text-gray-500">
              Create and manage community surveys, polls, and feedback forms. Survey results integrate with association reports.
            </p>
            <div className="mt-3">
              <Link href="/surveys" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-950">
                Manage surveys &rarr;
              </Link>
            </div>
          </div>
        </ReportSection>

        {/* ── All saved reports ── */}
        {savedRows.length > 0 && (
          <ReportSection title="All saved reports" count={savedRows.length}>
            <SavedReports rows={savedRows} />
          </ReportSection>
        )}

        {sortedCategories.length === 0 && favorites.length === 0 && (
          <div className="rounded-2xl border border-gray-200/70 bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            No reports match &quot;{q}&quot;.
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

function SavedReports({ rows }: { rows: SavedReport[] }) {
  return (
    <div className="divide-y divide-gray-100">
      {rows.map((report) => {
        const slug = report.report_definitions?.slug;
        return (
          <div key={report.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <Link
                href={slug ? `/reports/${slug}?saved=${report.id}` : '/reports'}
                className="truncate text-sm font-medium text-gray-900 hover:text-gray-950 hover:underline"
              >
                {report.name || report.report_definitions?.name || 'Untitled report'}
              </Link>
              <p className="mt-1 text-xs text-gray-500">
                Created by {report.profiles?.full_name ?? 'Unknown'}
                {report.last_run_at ? ` - last run ${date(report.last_run_at)}` : ''}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {report.run_count ?? 0} runs
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MetricTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-gray-950">{value}</div>
      <div className="mt-0.5 text-xs text-gray-500">{sub}</div>
    </div>
  );
}
