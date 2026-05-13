import Link from 'next/link';
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { filterReports, groupReports, type ReportDefinition } from '@/lib/reports/catalog';
import { reportHrefFromSlugParam } from '@/lib/reports/routing';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type SavedReport = {
  id: string;
  name: string;
  pinned: boolean;
  last_run_at: string | null;
  run_count: number | null;
  created_at: string;
  report_definitions: { slug: string; name: string } | null;
};

type ReportRun = {
  id: string;
  status: string;
  output_format: string | null;
  row_count: number | null;
  created_at: string;
  finished_at: string | null;
  report_definitions: { slug: string; name: string; category: string } | null;
};

export default async function ReportsIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; slug?: string }>;
}) {
  const { q = '', slug } = await searchParams;
  const slugHref = reportHrefFromSlugParam(slug);
  if (slugHref) redirect(slugHref);

  const supabase = await createClient();

  const [{ data: defs }, { data: saved }, { count: activeCount }, { count: scheduledCount }, { data: runs }] = await Promise.all([
    (supabase as any).from('report_definitions')
      .select('id, slug, name, description, category, active')
      .eq('active', true)
      .order('name'),
    (supabase as any).from('saved_reports')
      .select(`
        id, name, pinned, last_run_at, run_count, created_at,
        report_definitions(slug, name)
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
    (supabase as any).from('report_runs')
      .select('id, status, output_format, row_count, created_at, finished_at, report_definitions(slug, name, category)')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const definitions = (defs ?? []) as ReportDefinition[];
  const visibleDefinitions = filterReports(definitions, q);
  const groups = groupReports(visibleDefinitions);
  const savedRows = (saved ?? []) as unknown as SavedReport[];
  const favorites = savedRows.filter((report) => report.pinned);
  const recentRuns = (runs ?? []) as unknown as ReportRun[];
  const successfulRuns = recentRuns.filter((run) => run.status === 'succeeded').length;
  const featuredReports = pickFeaturedReports(definitions);

  return (
    <DataWorkspace
      title="Reports"
      description="Run association, owner, unit, banking, compliance, maintenance, and accounting reports from one scoped workspace."
      actions={
        <form action="/reports" method="get" className="flex min-w-80 items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search reports"
            className="h-10 min-w-64 rounded-md border border-ink-200 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      }
      rail={<ReportsRail scheduledCount={scheduledCount ?? 0} />}
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            { label: 'Active catalog', value: activeCount ?? definitions.length, sublabel: 'Available report definitions' },
            { label: 'Visible results', value: visibleDefinitions.length, sublabel: q ? `Filtered by "${q}"` : 'Current catalog view' },
            { label: 'Recent health', value: recentRuns.length ? `${successfulRuns}/${recentRuns.length}` : 'Ready', sublabel: recentRuns.length ? 'recent runs succeeded' : 'No run errors recorded' },
            { label: 'Scheduled runs', value: scheduledCount ?? 0, sublabel: <Link href="/scheduled-reports" className="text-champagne-700 hover:underline">Manage schedule</Link> },
          ]}
        />

        <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="rounded border border-ink-100 bg-white">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-ink-900">Report Command Center</h2>
                <p className="mt-0.5 text-xs text-ink-500">Verified live catalog, scoped filters, CSV exports, saved runs, and scheduled execution.</p>
              </div>
              <Link href="/reports/runs" className="text-xs font-semibold text-champagne-700 hover:underline">Run history</Link>
            </div>
            <div className="grid gap-px bg-ink-100 md:grid-cols-3">
              <CommandCell label="Executable export" value="CSV" detail="Live data generation and download route" />
              <CommandCell label="Catalog groups" value={groups.length} detail="Accounting, operations, people, compliance" />
              <CommandCell label="Saved reports" value={savedRows.length} detail={`${favorites.length} pinned favorites`} />
            </div>
          </div>

          <div className="rounded border border-ink-100 bg-white">
            <div className="border-b border-ink-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink-900">Recent runs</h2>
              <p className="mt-0.5 text-xs text-ink-500">Latest generated outputs across the portfolio.</p>
            </div>
            <RecentRuns rows={recentRuns} />
          </div>
        </section>

        {favorites.length > 0 && (
          <ReportSection title="Pinned saved reports" count={favorites.length}>
            <SavedReports rows={favorites} />
          </ReportSection>
        )}

        {!q && featuredReports.length > 0 && (
          <ReportSection title="Most used reports" count={featuredReports.length}>
            <ReportGrid items={featuredReports} />
          </ReportSection>
        )}

        <ReportLibrary groups={groups} query={q} />

        {savedRows.length > 0 && (
          <ReportSection title="Saved reports" count={savedRows.length}>
            <SavedReports rows={savedRows} />
          </ReportSection>
        )}

        {groups.length === 0 && favorites.length === 0 && (
          <div className="rounded border border-dashed border-ink-200 bg-white px-6 py-12 text-center text-sm text-ink-500">
            No reports match &quot;{q}&quot;.
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

function ReportsRail({ scheduledCount }: { scheduledCount: number }) {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-ink-900">Report operations</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/reports/runs" label="Run history" />
          <RailLink href="/scheduled-reports" label={`Scheduled reports (${scheduledCount})`} />
          <RailLink href="/reports/ar_aging" label="A/R aging live view" />
          <RailLink href="/reports/bank_reconciliation" label="Bank reconciliation" />
        </div>
      </section>
      <section className="border-t border-ink-100 pt-5">
        <h2 className="text-sm font-semibold text-ink-900">Scope discipline</h2>
        <p className="mt-2 text-sm leading-6 text-ink-600">
          Every run captures portfolio, association, owner, or unit scope plus dates so saved and scheduled reports can be reproduced.
        </p>
      </section>
      <section className="border-t border-ink-100 pt-5">
        <h2 className="text-sm font-semibold text-ink-900">Design guardrail</h2>
        <p className="mt-2 text-sm leading-6 text-ink-600">
          Portier follows property-management workflow expectations while using its own information architecture, brand language, and visual system.
        </p>
      </section>
    </div>
  );
}

function pickFeaturedReports(definitions: ReportDefinition[]) {
  const featuredSlugs = [
    'ar_aging',
    'bank_reconciliation',
    'balance_sheet',
    'income_statement',
    'general_ledger',
    'owner_ledger',
    'homeowner_directory',
    'check_register',
    'open_work_orders',
  ];
  const bySlug = new Map(definitions.map((definition) => [definition.slug, definition]));
  return featuredSlugs.map((slug) => bySlug.get(slug)).filter(Boolean) as ReportDefinition[];
}

function ReportLibrary({
  groups,
  query,
}: {
  groups: ReturnType<typeof groupReports>;
  query: string;
}) {
  return (
    <section className="rounded border border-ink-100 bg-white">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-900">Report library</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            {query ? 'Search results are expanded below.' : 'Open a category to browse the full Supabase-backed catalog.'}
          </p>
        </div>
        <span className="rounded bg-cream-100 px-2 py-0.5 text-xs font-medium tabular-nums text-ink-600">
          {groups.reduce((sum, group) => sum + group.items.length, 0)}
        </span>
      </div>
      <div className="divide-y divide-ink-100">
        {groups.map((group, index) => (
          <details key={group.category} open={Boolean(query) || index === 0} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 hover:bg-cream-50">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">{group.title}</h3>
                <p className="mt-0.5 text-xs text-ink-500">{group.items.length} report{group.items.length === 1 ? '' : 's'} available</p>
              </div>
              <span className="text-xs font-semibold text-champagne-700 group-open:hidden">Open</span>
              <span className="hidden text-xs font-semibold text-ink-500 group-open:inline">Close</span>
            </summary>
            <ReportGrid items={group.items} compact />
          </details>
        ))}
      </div>
    </section>
  );
}

function ReportGrid({ items, compact = false }: { items: ReportDefinition[]; compact?: boolean }) {
  return (
    <div className={`grid gap-2 p-4 ${compact ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-3'}`}>
      {items.map((definition) => (
        <Link
          key={definition.id}
          href={`/reports/${definition.slug}`}
          className="rounded border border-ink-100 bg-white px-3 py-3 text-sm hover:border-brand-200 hover:bg-brand-50"
        >
          <div className="font-medium text-champagne-700">{definition.name}</div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-500">{definition.description ?? 'Scoped report workspace'}</p>
        </Link>
      ))}
    </div>
  );
}

function CommandCell({ label, value, detail }: { label: string; value: ReactNode; detail: ReactNode }) {
  return (
    <div className="bg-white px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-ink-900">{value}</div>
      <div className="mt-1 text-xs leading-5 text-ink-500">{detail}</div>
    </div>
  );
}

function RecentRuns({ rows }: { rows: ReportRun[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-ink-500">
        No report runs yet. Open any report and run a CSV export to create the first entry.
      </div>
    );
  }

  return (
    <div className="divide-y divide-ink-100">
      {rows.slice(0, 5).map((run) => (
        <Link key={run.id} href={`/reports/runs/${run.id}`} className="block px-4 py-3 hover:bg-cream-50">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-medium text-ink-900">{run.report_definitions?.name ?? 'Report run'}</span>
            <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold capitalize ${run.status === 'succeeded' ? 'bg-green-100 text-green-700' : run.status === 'failed' ? 'bg-red-100 text-bordeaux-700' : 'bg-cream-100 text-ink-600'}`}>
              {run.status}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-ink-500">
            <span>{date(run.created_at)}</span>
            <span>{run.row_count?.toLocaleString() ?? '0'} rows</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ReportSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded border border-ink-100 bg-white">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        <span className="rounded bg-cream-100 px-2 py-0.5 text-xs font-medium tabular-nums text-ink-600">{count}</span>
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
              <Link href={slug ? `/reports/${slug}?saved=${report.id}` : '/reports'} className="truncate text-sm font-medium text-champagne-700 hover:underline">
                {report.name || report.report_definitions?.name || 'Untitled report'}
              </Link>
              <p className="mt-1 text-xs text-ink-500">
                Saved report{report.last_run_at ? ` - last run ${date(report.last_run_at)}` : ''}
              </p>
            </div>
            <span className="shrink-0 rounded bg-cream-100 px-2 py-0.5 text-xs text-ink-600">{report.run_count ?? 0} runs</span>
          </div>
        );
      })}
    </div>
  );
}

function RailLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded border border-ink-100 px-3 py-2 text-sm font-medium text-ink-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
      {label}
    </Link>
  );
}
