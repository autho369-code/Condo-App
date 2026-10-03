import Link from 'next/link';
import type { ReactNode } from 'react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterSelect } from '@/components/operations/filter-bar';
import { ReportingTabs } from '@/components/reports/reporting-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { REPORT_CATALOG, type CatalogReport } from '@/lib/reports/appfolio-catalog';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { deleteSavedReport, toggleReportFavorite, toggleSavedReportPin } from '@/lib/rpcs/reports';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SavedReport = {
  id: string;
  name: string;
  pinned: boolean;
  last_run_at: string | null;
  created_at: string;
  user_id: string | null;
  report_definitions: { slug: string; name: string } | null;
  creator_name?: string | null;
};

type Row = CatalogReport & { id: string; description: string };

export default async function ReportsIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string; saved_report?: string; deleted?: string; created_by?: string; created_from?: string; created_to?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const ql = q.toLowerCase();
  const createdBy = UUID.test(sp.created_by ?? '') ? sp.created_by! : '';
  const createdFrom = ISO.test(sp.created_from ?? '') ? sp.created_from! : '';
  const createdTo = ISO.test(sp.created_to ?? '') ? sp.created_to! : '';
  const db = (await createClient()) as any;

  const [defsResult, savedResult, { data: favoriteRows, error: favoriteError }] = await Promise.all([
    fetchAllRows<any>(() => db.from('report_definitions')
      .select('id, slug, description')
      .eq('active', true)
      .is('portfolio_id', null)
      .order('slug')
      .order('id')),
    fetchAllRows<any>(() => db.from('saved_reports')
      .select('id, name, pinned, last_run_at, created_at, user_id, report_definitions(slug, name)')
      .order('name')
      .order('id')),
    // RLS returns only the signed-in user's own favorites.
    db.from('report_favorites').select('definition_id'),
  ]);
  const loadError = defsResult.error ?? savedResult.error ?? favoriteError?.message ?? null;
  const defBySlug = new Map<string, { id: string; description: string | null }>(
    (defsResult.rows as any[]).map((d) => [d.slug, { id: d.id, description: d.description }]),
  );
  const favoriteIds = new Set<string>(((favoriteRows ?? []) as any[]).map((r) => r.definition_id));

  // Catalog entries whose report definition exists, alphabetical like AppFolio.
  const matchesQuery = (r: Row) => !ql || r.name.toLowerCase().includes(ql) || r.description.toLowerCase().includes(ql);
  const categories = REPORT_CATALOG.map((c) => ({
    ...c,
    rows: c.reports
      .flatMap((r) => {
        const def = defBySlug.get(r.slug);
        return def ? [{ ...r, id: def.id, description: def.description ?? '' }] : [];
      })
      .filter(matchesQuery)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((c) => c.rows.length > 0);
  const favorites = [...new Map(categories.flatMap((c) => c.rows).filter((r) => favoriteIds.has(r.id)).map((r) => [r.id, r])).values()]
    .sort((a, b) => a.name.localeCompare(b.name));

  // Saved reports: creator names come from profiles (no FK to embed).
  const savedRows = savedResult.rows as SavedReport[];
  const creatorIds = [...new Set(savedRows.map((r) => r.user_id).filter(Boolean))] as string[];
  const creators = new Map<string, string>();
  if (creatorIds.length) {
    const { data } = await db.from('profiles').select('id, full_name').in('id', creatorIds);
    for (const p of (data ?? []) as any[]) creators.set(p.id, p.full_name ?? 'Unknown');
  }
  for (const r of savedRows) r.creator_name = r.user_id ? creators.get(r.user_id) ?? null : null;
  const savedVisible = savedRows.filter((r) =>
    (!createdBy || r.user_id === createdBy) &&
    (!createdFrom || r.created_at.slice(0, 10) >= createdFrom) &&
    (!createdTo || r.created_at.slice(0, 10) <= createdTo) &&
    (!ql || (r.name ?? '').toLowerCase().includes(ql) || (r.report_definitions?.name ?? '').toLowerCase().includes(ql)));

  // Pinned saved reports show with the starred reports in Favorite Reports.
  const pinnedSaved = savedRows.filter((r) => r.pinned && (!ql || (r.name ?? '').toLowerCase().includes(ql)));

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ q, created_by: createdBy, created_from: createdFrom, created_to: createdTo })) if (v) params.set(k, v);
  const returnTo = params.toString() ? `/reports?${params}` : '/reports';

  return (
    <DataWorkspace
      title="Reports"
      actions={<Link href="/reports/builder"><Button variant="secondary">Report Builder</Button></Link>}
    >
      <ReportingTabs current="reports" />
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Something went wrong">{sp.error}</Alert>}
        {loadError && <Alert tone="danger" title="Could not load every report">{loadError}</Alert>}
        {sp.saved_report && <Alert tone="success">Custom report saved.</Alert>}
        {sp.deleted && <Alert tone="success">Custom report deleted.</Alert>}

        <form action="/reports" method="get" className="flex items-center gap-2">
          <Input type="search" name="q" defaultValue={q} placeholder="Search reports by name or description" aria-label="Search reports" className="min-w-0 flex-1" />
          <Button type="submit" variant="secondary">Search</Button>
        </form>

        {(favorites.length > 0 || pinnedSaved.length > 0) && (
          <ReportSection title="Favorite Reports">
            {favorites.length > 0 && <ReportGrid rows={favorites} favoriteIds={favoriteIds} returnTo={returnTo} />}
            {pinnedSaved.length > 0 && <SavedReports rows={pinnedSaved} returnTo={returnTo} />}
          </ReportSection>
        )}

        {categories.map((c) => (
          <ReportSection key={c.key} title={c.title}>
            <ReportGrid rows={c.rows} favoriteIds={favoriteIds} returnTo={returnTo} />
          </ReportSection>
        ))}

        {q && categories.length === 0 && savedVisible.length === 0 && (
          <div className="rounded-2xl border border-gray-200/70 bg-white px-6 py-12 text-center text-sm text-gray-500 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            No reports match &quot;{q}&quot;.
          </div>
        )}

        <ReportSection title="Saved Reports">
          <form action="/reports" method="get" className="grid grid-cols-1 gap-3 border-b border-gray-100 px-4 py-3 sm:grid-cols-4">
            {q && <input type="hidden" name="q" value={q} />}
            <FilterSelect label="Created by" name="created_by" defaultValue={createdBy}>
              <option value="">Anyone</option>
              {[...creators.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </FilterSelect>
            <label className="text-xs font-medium text-gray-600">Created from
              <Input type="date" name="created_from" defaultValue={createdFrom} className="mt-1" />
            </label>
            <label className="text-xs font-medium text-gray-600">Created to
              <Input type="date" name="created_to" defaultValue={createdTo} className="mt-1" />
            </label>
            <div className="flex items-end"><Button type="submit" variant="secondary">Filter</Button></div>
          </form>
          {savedVisible.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500">
              {savedRows.length === 0 ? 'No saved reports yet. Open a report, set its filters, and use Save as custom report.' : 'No saved reports match these filters.'}
            </p>
          ) : (
            <SavedReports rows={savedVisible} returnTo={returnTo} />
          )}
        </ReportSection>
      </div>
    </DataWorkspace>
  );
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details open className="group rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 border-b border-gray-100 px-4 py-3 text-[15px] font-semibold text-gray-950 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-gray-400 transition-transform group-open:rotate-90">›</span>
        {title}
      </summary>
      {children}
    </details>
  );
}

/** Three columns, filled top to bottom, each report with a star and a menu. */
function ReportGrid({ rows, favoriteIds, returnTo }: { rows: Row[]; favoriteIds: Set<string>; returnTo: string }) {
  return (
    <ul className="columns-1 gap-3 p-3 sm:columns-2 lg:columns-3">
      {rows.map((r) => {
        const starred = favoriteIds.has(r.id);
        return (
          <li key={r.slug} className="mb-1 break-inside-avoid rounded-lg border border-gray-100">
            <details className="group/item">
              <summary className="flex min-h-[40px] list-none items-center gap-1 pl-3 pr-1 [&::-webkit-details-marker]:hidden">
                <Link href={`/reports/${r.slug}`} className="min-w-0 flex-1 truncate py-2 text-sm font-medium text-gray-900 hover:underline">{r.name}</Link>
                <form action={toggleReportFavorite}>
                  <input type="hidden" name="definition_id" value={r.id} />
                  <input type="hidden" name="favorite" value={starred ? '0' : '1'} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <button
                    type="submit"
                    aria-label={starred ? `Remove ${r.name} from favorites` : `Add ${r.name} to favorites`}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors hover:bg-gray-100 ${starred ? 'text-amber-500' : 'text-gray-300 hover:text-gray-500'}`}
                  >
                    {starred ? '★' : '☆'}
                  </button>
                </form>
                <span aria-label={`More about ${r.name}`} className="flex h-10 w-8 cursor-pointer items-center justify-center text-gray-400 transition-transform group-open/item:rotate-180">⌄</span>
              </summary>
              <div className="space-y-2 border-t border-gray-100 px-3 py-2 text-xs text-gray-600">
                {r.description && <p>{r.description}</p>}
                <div className="flex gap-3">
                  <Link href={`/reports/${r.slug}`} className="font-medium text-gray-900 hover:underline">Run report</Link>
                  <Link href={`/scheduled-reports/new?report=${r.id}`} className="font-medium text-gray-900 hover:underline">Schedule</Link>
                </div>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
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
              <Link href={slug ? `/reports/${slug}?saved=${report.id}` : '/reports'} className="truncate text-sm font-medium text-gray-900 hover:underline">
                {report.name || report.report_definitions?.name || 'Untitled report'}
              </Link>
              <p className="mt-1 text-xs text-gray-500">
                {report.report_definitions?.name ?? 'Report'}
                {' · '}Created by {report.creator_name ?? 'Unknown'} on {date(report.created_at)}
                {report.last_run_at ? ` · last run ${date(report.last_run_at)}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link href={`/scheduled-reports/new?custom=${report.id}`}><Button variant="secondary" size="sm">Schedule</Button></Link>
              <form action={toggleSavedReportPin}>
                <input type="hidden" name="saved_report_id" value={report.id} />
                <input type="hidden" name="pinned" value={report.pinned ? '0' : '1'} />
                <input type="hidden" name="return_to" value={returnTo} />
                <Button type="submit" variant="secondary" size="sm">{report.pinned ? 'Unpin' : 'Pin'}</Button>
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
