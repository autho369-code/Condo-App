import Link from 'next/link';
import type { ReactNode } from 'react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { filterReports, groupReports, type ReportDefinition } from '@/lib/reports/catalog';
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
  profiles: { full_name: string | null } | null;
};

export default async function ReportsIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const supabase = await createClient();

  const [{ data: defs }, { data: saved }, { count: activeCount }, { count: scheduledCount }] = await Promise.all([
    supabase.from('report_definitions')
      .select('id, slug, name, description, category, active')
      .eq('active', true)
      .order('name'),
    supabase.from('saved_reports')
      .select(`
        id, name, pinned, last_run_at, run_count, created_at,
        report_definitions(slug, name),
        profiles(full_name)
      `)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('report_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('active', true),
    supabase.from('scheduled_reports')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
      .eq('active', true),
  ]);

  const definitions = (defs ?? []) as ReportDefinition[];
  const visibleDefinitions = filterReports(definitions, q);
  const groups = groupReports(visibleDefinitions);
  const savedRows = (saved ?? []) as unknown as SavedReport[];
  const favorites = savedRows.filter((report) => report.pinned);

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
            className="h-10 min-w-64 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
            { label: 'Saved reports', value: savedRows.length, sublabel: `${favorites.length} pinned favorites` },
            { label: 'Scheduled runs', value: scheduledCount ?? 0, sublabel: <Link href="/scheduled-reports" className="text-blue-700 hover:underline">Manage schedule</Link> },
          ]}
        />

        {favorites.length > 0 && (
          <ReportSection title="Pinned saved reports" count={favorites.length}>
            <SavedReports rows={favorites} />
          </ReportSection>
        )}

        {groups.map((group) => (
          <ReportSection key={group.category} title={group.title} count={group.items.length}>
            <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((definition) => (
                <Link
                  key={definition.id}
                  href={`/reports/${definition.slug}`}
                  className="rounded border border-gray-200 bg-white px-3 py-3 text-sm hover:border-brand-200 hover:bg-brand-50"
                >
                  <div className="font-medium text-blue-700">{definition.name}</div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{definition.description ?? 'Scoped report workspace'}</p>
                </Link>
              ))}
            </div>
          </ReportSection>
        ))}

        {savedRows.length > 0 && (
          <ReportSection title="Saved reports" count={savedRows.length}>
            <SavedReports rows={savedRows} />
          </ReportSection>
        )}

        {groups.length === 0 && favorites.length === 0 && (
          <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
            No reports match "{q}".
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
        <h2 className="text-sm font-semibold text-gray-950">Report operations</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/reports/runs" label="Run history" />
          <RailLink href="/scheduled-reports" label={`Scheduled reports (${scheduledCount})`} />
          <RailLink href="/reports/ar_aging" label="A/R aging live view" />
          <RailLink href="/reports/bank_reconciliation" label="Bank reconciliation" />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Scope discipline</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Every run captures portfolio, association, owner, or unit scope plus dates so saved and scheduled reports can be reproduced.
        </p>
      </section>
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
    <section className="rounded border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600">{count}</span>
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
              <Link href={slug ? `/reports/${slug}?saved=${report.id}` : '/reports'} className="truncate text-sm font-medium text-blue-700 hover:underline">
                {report.name || report.report_definitions?.name || 'Untitled report'}
              </Link>
              <p className="mt-1 text-xs text-gray-500">
                Created by {report.profiles?.full_name ?? 'Unknown'}{report.last_run_at ? ` - last run ${date(report.last_run_at)}` : ''}
              </p>
            </div>
            <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{report.run_count ?? 0} runs</span>
          </div>
        );
      })}
    </div>
  );
}

function RailLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
      {label}
    </Link>
  );
}
