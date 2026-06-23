import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { DataTable, type Column } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import {
  BUILDER_SOURCES,
  buildBuilderQuery,
  formatCell,
  getSource,
  parseBuilderRequest,
  toBuilderQueryString,
  type BuilderFilters,
} from '@/lib/reports/builder-catalog';
import { BuilderForm } from './builder-form';
import { saveReportView, deleteReportView } from './actions';

export const dynamic = 'force-dynamic';

// Catalog data is server-only; pass a plain serializable subset to the client form.
const CLIENT_SOURCES = BUILDER_SOURCES.map((s) => ({
  key: s.key,
  label: s.label,
  columns: s.columns,
  filterableAssociation: s.filterableAssociation,
  dateColumn: s.dateColumn,
  statusColumn: s.statusColumn,
}));

type SavedView = {
  id: string;
  name: string;
  source_key: string;
  columns: string[];
  filters: BuilderFilters;
  created_at: string;
};

function savedViewQuery(view: SavedView): string {
  const req = parseBuilderRequest({
    source: view.source_key,
    cols: Array.isArray(view.columns) ? view.columns : [],
    association: view.filters?.association,
    status: view.filters?.status,
    from: view.filters?.from,
    to: view.filters?.to,
  });
  return req ? toBuilderQueryString(req) : `source=${encodeURIComponent(view.source_key)}`;
}

export default async function ReportBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    cols?: string;
    association?: string;
    status?: string;
    from?: string;
    to?: string;
    error?: string;
    saved?: string;
    deleted?: string;
  }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();

  // Associations for the dropdown (RLS scopes these to the manager's portfolio).
  const { data: assocRows } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .order('name');
  const associations = (assocRows ?? []) as { id: string; name: string }[];

  // Saved views for this portfolio (RLS-scoped).
  const { data: savedRows } = await (supabase as any)
    .from('saved_report_views')
    .select('id, name, source_key, columns, filters, created_at')
    .order('created_at', { ascending: false });
  const savedViews = (savedRows ?? []) as SavedView[];

  // Validate + run the report if a source was requested.
  const req = parseBuilderRequest(sp);
  let rows: Record<string, unknown>[] = [];
  let runError: string | null = null;
  let exportQuery = '';

  if (req) {
    exportQuery = toBuilderQueryString(req);
    const { data, error } = await buildBuilderQuery(supabase as any, req);
    if (error) runError = (error as { message?: string }).message ?? 'Query failed.';
    else rows = (data ?? []) as Record<string, unknown>[];
  }

  // Current querystring (for the save/delete forms to bounce back to).
  const currentQuery = req ? exportQuery : '';

  const initial = {
    source: req?.source.key ?? sp.source ?? BUILDER_SOURCES[0].key,
    cols: req ? req.columns.map((c) => c.key) : [],
    association: req?.filters.association ?? '',
    status: req?.filters.status ?? '',
    from: req?.filters.from ?? '',
    to: req?.filters.to ?? '',
  };

  const resultColumns: Column<Record<string, unknown>>[] = req
    ? req.columns.map((c) => ({
        key: c.key,
        header: c.label,
        render: (row) => formatCell(row[c.key]),
      }))
    : [];

  return (
    <DataWorkspace
      title="Report Builder"
      description="Pick a data source, choose the columns and filters you need, run it live, and save the view to reuse later. Exports to CSV."
    >
      <div className="space-y-6">
        {sp.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            <span className="font-semibold">Could not save:</span> {sp.error}
          </div>
        )}
        {sp.saved === '1' && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700" role="status">
            Report saved.
          </div>
        )}
        {sp.deleted === '1' && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700" role="status">
            Saved report deleted.
          </div>
        )}

        {/* Builder form */}
        <section className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-950">Build a report</h2>
          <BuilderForm sources={CLIENT_SOURCES} associations={associations} initial={initial} />
        </section>

        {/* Results */}
        {req && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-950">
                  {req.source.label} — {rows.length} row{rows.length === 1 ? '' : 's'}
                  {rows.length === 500 ? ' (showing first 500)' : ''}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/reports/builder/export?${exportQuery}`} prefetch={false}>
                  <Button variant="secondary" size="sm">Export CSV</Button>
                </Link>
              </div>
            </div>

            {runError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                <span className="font-semibold">Query error:</span> {runError}
              </div>
            ) : (
              <DataTable
                columns={resultColumns}
                rows={rows.map((r, i) => ({ ...r, __rowKey: String(i) }))}
                rowKey={(row) => String(row.__rowKey)}
                empty={
                  <div className="px-6 py-12 text-center text-sm text-gray-500">
                    No rows matched your filters.
                  </div>
                }
              />
            )}

            {/* Save this report */}
            <div className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <form action={saveReportView} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="query" value={currentQuery} />
                <Field label="Save this report" htmlFor="name" className="min-w-64 flex-1">
                  <Input id="name" name="name" placeholder="e.g. Open work orders — Granville" required />
                </Field>
                <Button type="submit">Save report</Button>
              </form>
            </div>
          </section>
        )}

        {/* Saved reports */}
        <section className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-950">Saved reports</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600">
              {savedViews.length}
            </span>
          </div>
          {savedViews.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No saved reports yet. Run a report above and save it to reuse later.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {savedViews.map((view) => {
                const source = getSource(view.source_key);
                const q = savedViewQuery(view);
                return (
                  <div key={view.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/reports/builder?${q}`}
                        className="truncate text-sm font-medium text-gray-900 hover:text-gray-950 hover:underline"
                      >
                        {view.name}
                      </Link>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {source?.label ?? view.source_key}
                        {Array.isArray(view.columns) ? ` · ${view.columns.length} columns` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link href={`/reports/builder/export?${q}`} prefetch={false}>
                        <Button variant="ghost" size="sm">CSV</Button>
                      </Link>
                      <form action={deleteReportView}>
                        <input type="hidden" name="id" value={view.id} />
                        <input type="hidden" name="query" value={currentQuery} />
                        <Button type="submit" variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DataWorkspace>
  );
}
