import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarClock, Star } from 'lucide-react';
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
import { PendingSubmit } from '@/components/ui/pending-submit';

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

// Active reports the catalog file does not list are still shown, under the
// section matching their own category (none is hidden).
const SECTION_FOR_CATEGORY: Record<string, { key: string; title: string }> = {
  accounting: { key: 'accounting', title: 'Accounting Reports' },
  association: { key: 'association', title: 'Association Reports' },
  property_unit: { key: 'property_unit', title: 'Association And Unit Reports' },
  maintenance: { key: 'maintenance', title: 'Maintenance Reports' },
  compliance: { key: 'diagnostic', title: 'Diagnostic Reports' },
  communication: { key: 'communication', title: 'Communication Reports' },
  people: { key: 'people', title: 'People Reports' },
};

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
      .select('id, slug, name, category, description')
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
  const defs = defsResult.rows as any[];
  const defBySlug = new Map<string, { id: string; description: string | null }>(
    defs.map((d) => [d.slug, { id: d.id, description: d.description }]),
  );
  const favoriteIds = new Set<string>(((favoriteRows ?? []) as any[]).map((r) => r.definition_id));

  // Every active report: the catalog's entries under its headings, then any
  // active report the catalog does not list, under its own category.
  const listed = new Set(REPORT_CATALOG.flatMap((c) => c.reports.map((r) => r.slug)));
  const sections = new Map<string, { key: string; title: string; reports: CatalogReport[] }>(
    REPORT_CATALOG.map((c) => [c.key, { key: c.key, title: c.title, reports: [...c.reports] }]),
  );
  for (const d of defs) {
    if (listed.has(d.slug)) continue;
    const target = SECTION_FOR_CATEGORY[d.category] ?? { key: 'other', title: 'Other Reports' };
    if (!sections.has(target.key)) sections.set(target.key, { ...target, reports: [] });
    sections.get(target.key)!.reports.push({ name: d.name, slug: d.slug });
  }

  const matchesQuery = (r: Row) => !ql || r.name.toLowerCase().includes(ql) || r.description.toLowerCase().includes(ql);
  const allCategories = [...sections.values()].map((c) => ({
    ...c,
    rows: c.reports
      .flatMap((r) => {
        const def = defBySlug.get(r.slug);
        return def ? [{ ...r, id: def.id, description: def.description ?? '' }] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  })).filter((c) => c.rows.length > 0);
  const totalReports = new Set(allCategories.flatMap((c) => c.rows.map((r) => r.slug))).size;
  const categories = allCategories
    .map((c) => ({ ...c, rows: c.rows.filter(matchesQuery) }))
    .filter((c) => c.rows.length > 0);
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
  const shown = categories.reduce((n, c) => n + c.rows.length, 0);

  return (
    <DataWorkspace
      title="Reports"
      description={`${totalReports} reports. Search by name or what a report shows, star the ones you use, and schedule any of them.`}
      actions={<Link href="/reports/builder"><Button variant="secondary">Report Builder</Button></Link>}
    >
      <ReportingTabs current="reports" />
      <div className="space-y-5">
        {sp.error && <Alert tone="danger" title="Something went wrong">{sp.error}</Alert>}
        {loadError && <Alert tone="danger" title="Could not load every report">{loadError}</Alert>}
        {sp.saved_report && <Alert tone="success">Custom report saved.</Alert>}
        {sp.deleted && <Alert tone="success">Custom report deleted.</Alert>}

        <div className="rounded-2xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <form action="/reports" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input type="search" name="q" defaultValue={q} placeholder="Search reports, e.g. delinquency, 1099, trial balance" aria-label="Search reports" className="h-11 min-w-0 flex-1 text-[15px]" />
            <Button type="submit" size="lg">Search</Button>
          </form>
          {categories.length > 0 && (
            <nav aria-label="Report categories" className="mt-3 flex flex-wrap gap-2">
              {q && <span className="inline-flex min-h-9 items-center text-[13px] text-gray-500">{shown} match{shown === 1 ? '' : 'es'} for &quot;{q}&quot; ·</span>}
              {(favorites.length > 0 || pinnedSaved.length > 0) && <CategoryChip href="#favorites" label="Favorites" count={favorites.length + pinnedSaved.length} />}
              {categories.map((c) => <CategoryChip key={c.key} href={sectionAnchor(c.key)} label={c.title.replace(/ Reports$/, '')} count={c.rows.length} />)}
              <CategoryChip href="#saved" label="Saved" count={savedVisible.length} />
            </nav>
          )}
        </div>

        {(favorites.length > 0 || pinnedSaved.length > 0) && (
          <ReportSection id="favorites" title="Favorite Reports" count={favorites.length + pinnedSaved.length}>
            {favorites.length > 0 && <ReportGrid rows={favorites} favoriteIds={favoriteIds} returnTo={returnTo} />}
            {pinnedSaved.length > 0 && <SavedReports rows={pinnedSaved} returnTo={returnTo} />}
          </ReportSection>
        )}

        {categories.map((c) => (
          <ReportSection key={c.key} id={c.key} title={c.title} count={c.rows.length}>
            <ReportGrid rows={c.rows} favoriteIds={favoriteIds} returnTo={returnTo} />
          </ReportSection>
        ))}

        {q && categories.length === 0 && savedVisible.length === 0 && (
          <div className="rounded-2xl border border-line bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <p className="font-display text-[17px] font-semibold text-ink">No reports match &quot;{q}&quot;</p>
            <p className="mt-1.5 text-sm text-gray-500">Try a shorter word, or <Link href="/reports" className="font-medium text-gray-900 underline underline-offset-4">show all reports</Link>.</p>
          </div>
        )}

        <ReportSection id="saved" title="Saved Reports" count={savedVisible.length}>
          <form action="/reports" method="get" className="grid grid-cols-1 gap-3 border-b border-line px-5 py-4 sm:grid-cols-4">
            {q && <input type="hidden" name="q" value={q} />}
            <FilterSelect label="Created by" name="created_by" defaultValue={createdBy}>
              <option value="">Anyone</option>
              {[...creators.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </FilterSelect>
            <label className="text-[13.5px] font-medium text-gray-700">Created from
              <Input type="date" name="created_from" defaultValue={createdFrom} className="mt-1.5" />
            </label>
            <label className="text-[13.5px] font-medium text-gray-700">Created to
              <Input type="date" name="created_to" defaultValue={createdTo} className="mt-1.5" />
            </label>
            <div className="flex items-end"><Button type="submit" variant="secondary">Filter</Button></div>
          </form>
          {savedVisible.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-500">
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

/** In-page link to a category section (each ReportSection gets the key as its id). */
function sectionAnchor(key: string): string {
  return '#' + key;
}

function CategoryChip({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <a href={href} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[13px] font-medium text-gray-700 hover:border-gray-300 hover:text-ink">
      {label}<span className="tabular-nums text-gray-400">{count}</span>
    </a>
  );
}

function ReportSection({ id, title, count, children }: { id: string; title: string; count: number; children: ReactNode }) {
  return (
    <details id={id} open className="group scroll-mt-6 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-2.5 border-b border-line px-5 py-3.5 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-gray-400 transition-transform group-open:rotate-90">›</span>
        <span className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</span>
        <span className="text-[13px] tabular-nums text-gray-400">{count}</span>
      </summary>
      {children}
    </details>
  );
}

/** Each report with its full name, what it shows, a star and Schedule; the name runs it. */
function ReportGrid({ rows, favoriteIds, returnTo }: { rows: Row[]; favoriteIds: Set<string>; returnTo: string }) {
  return (
    <ul className="grid grid-cols-1 divide-y divide-line md:grid-cols-2 md:divide-y-0 xl:grid-cols-3">
      {rows.map((r) => {
        const starred = favoriteIds.has(r.id);
        return (
          <li key={r.slug} className="flex items-start gap-1 px-3 py-2 md:border-b md:border-line">
            <Link href={`/reports/${r.slug}`} className="group/report min-w-0 flex-1 rounded-lg px-2 py-2 hover:bg-gray-50">
              <span className="block text-[14.5px] font-semibold leading-5 text-ink group-hover/report:underline group-hover/report:underline-offset-4">{r.name}</span>
              {r.description && <span className="mt-1 block text-[13px] leading-5 text-gray-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">{r.description}</span>}
            </Link>
            <div className="flex shrink-0 items-center">
              <Link href={`/scheduled-reports/new?report=${r.id}`} aria-label={`Schedule ${r.name}`} title="Schedule" className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <CalendarClock className="h-[18px] w-[18px]" />
              </Link>
              <form action={toggleReportFavorite}>
                <input type="hidden" name="definition_id" value={r.id} />
                <input type="hidden" name="favorite" value={starred ? '0' : '1'} />
                <input type="hidden" name="return_to" value={returnTo} />
                <button
                  type="submit"
                  aria-label={starred ? `Remove ${r.name} from favorites` : `Add ${r.name} to favorites`}
                  aria-pressed={starred}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-gray-100 ${starred ? 'text-amber-500' : 'text-gray-300 hover:text-gray-500'}`}
                >
                  <Star className="h-[18px] w-[18px]" fill={starred ? 'currentColor' : 'none'} />
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SavedReports({ rows, returnTo }: { rows: SavedReport[]; returnTo: string }) {
  return (
    <div className="divide-y divide-line">
      {rows.map((report) => {
        const slug = report.report_definitions?.slug;
        return (
          <div key={report.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <Link href={slug ? `/reports/${slug}?saved=${report.id}` : '/reports'} className="text-[14.5px] font-semibold text-ink hover:underline hover:underline-offset-4">
                {report.name || report.report_definitions?.name || 'Untitled report'}
              </Link>
              <p className="mt-1 text-[13px] text-gray-500">
                {report.report_definitions?.name ?? 'Report'}
                {' · '}Created by {report.creator_name ?? 'Unknown'} on {date(report.created_at)}
                {report.last_run_at ? ` · last run ${date(report.last_run_at)}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                <PendingSubmit variant="secondary" size="sm" pendingLabel="Deleting…" confirm="Delete this saved report?">Delete</PendingSubmit>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}
