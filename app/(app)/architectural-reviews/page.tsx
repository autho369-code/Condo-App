import Link from 'next/link';
import { Plus } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { ExportActions, type ExportTable } from '@/components/export/export-actions';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import { displayTimeZone } from '@/lib/time/display-zone';
import { todayInZone, zonedWallTimeToUtc } from '@/lib/time/zoned';
import { descNullsLast, unionSearch } from '@/lib/supabase/search-union';

export const dynamic = 'force-dynamic';

const OPEN_STATUSES = ['submitted', 'under_review', 'more_info'];

const STATUS_TONE: Record<string, Tone> = {
  submitted: 'info', under_review: 'warning', more_info: 'warning',
  approved: 'success', denied: 'danger', withdrawn: 'neutral',
};

const CATEGORY_LABEL: Record<string, string> = {
  exterior_paint: 'Exterior paint', fence: 'Fence', landscaping: 'Landscaping',
  roof: 'Roof', addition: 'Addition', deck_patio: 'Deck / patio',
  windows_doors: 'Windows / doors', solar: 'Solar', pool: 'Pool', other: 'Other',
};

function label(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ArchitecturalReviewQueue({
  searchParams,
}: {
  searchParams: Promise<{ association?: string; status?: string; category?: string; from?: string; to?: string; q?: string }>;
}) {
  const me = await requireStaff();
  const filters = await searchParams;
  // Month boundaries in the association's local time, not the server's UTC.
  const zone = displayTimeZone();
  const todayDate = todayInZone(zone);
  // Local midnight of a YYYY-MM-DD day, as a UTC instant for timestamptz columns.
  const localMidnight = (day: string) => zonedWallTimeToUtc(day, '00:00', zone)?.toISOString() ?? `${day}T00:00:00Z`;
  const nextDay = (day: string) => new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const monthStart = localMidnight(`${todayDate.slice(0, 8)}01`);
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const dateFrom = isDate(filters.from) ? filters.from! : '';
  const dateTo = isDate(filters.to) ? filters.to! : '';
  const category = filters.category && filters.category in CATEGORY_LABEL ? filters.category : '';
  const status = filters.status === 'open' || (filters.status && filters.status in STATUS_TONE) ? filters.status : '';

  const supabase = await createClient();
  const db = supabase as any;

  // Every filter runs in the query, so the 500-row window holds matching
  // requests (filtering the 500 newest afterwards dropped older ones).
  const LIST_COLUMNS = 'id, title, category, status, created_at, decided_at, association_id, associations(name), units!architectural_requests_unit_id_fkey(unit_number), owners!architectural_requests_owner_id_fkey(full_name)';
  const listQuery = (extraColumns = '') => {
    let q = db.from('architectural_requests').select(LIST_COLUMNS + extraColumns);
    if (filters.association) q = q.eq('association_id', filters.association);
    if (status === 'open') q = q.in('status', OPEN_STATUSES);
    else if (status) q = q.eq('status', status);
    if (category) q = q.eq('category', category);
    if (dateFrom) q = q.gte('created_at', localMidnight(dateFrom));
    // Inclusive of the whole "to" day.
    if (dateTo) q = q.lt('created_at', localMidnight(nextDay(dateTo)));
    return q.order('created_at', { ascending: false }).limit(500);
  };
  // Search: title, association, homeowner or unit number, each as its own
  // query (see unionSearch) so no match is dropped by a capped id lookup.
  const term = (filters.q ?? '').replace(/[%_,()*"\\]/g, ' ').trim();
  const reviewsQuery: PromiseLike<{ data: any[] | null; error: any }> = term
    ? unionSearch<any>([
        listQuery().ilike('title', `%${term}%`),
        listQuery(', s_a:associations!inner(name)').ilike('s_a.name', `%${term}%`),
        listQuery(', s_o:owners!architectural_requests_owner_id_fkey!inner(full_name)').ilike('s_o.full_name', `%${term}%`),
        listQuery(', s_u:units!architectural_requests_unit_id_fkey!inner(unit_number)').ilike('s_u.unit_number', term),
      ], (a, b) => descNullsLast(a.created_at, b.created_at), 500).then(({ rows, error }) => ({ data: rows, error }))
    : listQuery();

  // Tiles are counted in the database so the queue view (which narrows the
  // list to open requests) does not zero out the monthly decision counts.
  const [{ data: associations }, { data: rows, error: listError }, { count: awaitingCount }, { count: approvedCount }, { count: deniedCount }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    reviewsQuery,
    db.from('architectural_requests').select('id', { count: 'exact', head: true }).in('status', OPEN_STATUSES),
    db.from('architectural_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved').gte('decided_at', monthStart),
    db.from('architectural_requests').select('id', { count: 'exact', head: true }).eq('status', 'denied').gte('decided_at', monthStart),
  ]);

  const filtered = (rows ?? []) as any[];

  const awaiting = awaitingCount ?? 0;
  const approvedThisMonth = approvedCount ?? 0;
  const deniedThisMonth = deniedCount ?? 0;

  const metrics: Metric[] = [
    { label: 'Awaiting Review', value: awaiting, sublabel: <Link href="/architectural-reviews?status=open" className="font-medium text-gray-500 transition-colors hover:text-gray-900">View queue</Link> },
    { label: 'Approved This Month', value: approvedThisMonth, sublabel: 'Decisions recorded' },
    { label: 'Denied This Month', value: deniedThisMonth, sublabel: 'Decisions recorded' },
  ];

  const exportTable: ExportTable = {
    columns: [
      { header: 'Request' }, { header: 'Type' }, { header: 'Association' }, { header: 'Unit' },
      { header: 'Homeowner' }, { header: 'Status' }, { header: 'Submitted' }, { header: 'Decided' },
    ],
    rows: filtered.map((r) => [
      r.title ?? '',
      CATEGORY_LABEL[r.category] ?? 'Other',
      r.associations?.name ?? '—',
      r.units?.unit_number ?? '—',
      r.owners?.full_name ?? '—',
      label(r.status),
      date(r.created_at),
      r.decided_at ? date(r.decided_at) : '—',
    ]),
  };

  return (
    <DataWorkspace
      title="Architectural Reviews"
      description="Review homeowner modification requests, discuss in-thread, and record the board's decision."
      actions={
        <>
          <ExportActions
            documentTitle="Architectural Reviews"
            companyName={me.portfolio?.company_name ?? 'Management company'}
            filename={`architectural-reviews-${todayDate}`}
            tables={[exportTable]}
          />
          <Link href="/architectural-reviews/new">
            <Button><Plus className="h-4 w-4" /> New request</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />
        {listError && <Alert tone="danger" title="Could not load requests:">{listError.message ?? String(listError)}</Alert>}

        <FilterBar action="/architectural-reviews" searchDefault={filters.q ?? ''} searchPlaceholder="Search title, association, homeowner, unit...">
          <FilterSelect label="Association" name="association" defaultValue={filters.association ?? ''}>
            <option value="">All</option>
            {(associations ?? []).map((a: any) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </FilterSelect>
          <FilterSelect label="Status" name="status" defaultValue={status}>
            <option value="">Any</option>
            <option value="open">Awaiting review</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="more_info">More info</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="withdrawn">Withdrawn</option>
          </FilterSelect>
          <FilterSelect label="Type" name="category" defaultValue={category}>
            <option value="">Any</option>
            {Object.entries(CATEGORY_LABEL).map(([value, text]) => (<option key={value} value={value}>{text}</option>))}
          </FilterSelect>
          <label className="text-[12px] font-medium text-gray-500">
            Submitted from
            <input type="date" name="from" defaultValue={dateFrom} className="mt-1 block h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </label>
          <label className="text-[12px] font-medium text-gray-500">
            To
            <input type="date" name="to" defaultValue={dateTo} className="mt-1 block h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </label>
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState title="No architectural requests" description="Homeowner requests submitted from the owner portal will appear here for review." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Request</TH>
                <TH>Type</TH>
                <TH>Association</TH>
                <TH>Unit</TH>
                <TH>Homeowner</TH>
                <TH>Status</TH>
                <TH>Submitted</TH>
                <TH>Decided</TH>
              </TR>
            </THead>
            <tbody>
              {filtered.map((r) => (
                <TR key={r.id}>
                  <TD className="max-w-xs">
                    <Link href={`/architectural-reviews/${r.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">{r.title}</Link>
                  </TD>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{CATEGORY_LABEL[r.category] ?? 'Other'}</TD>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{r.associations?.name ?? '—'}</TD>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{r.units?.unit_number ?? '—'}</TD>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{r.owners?.full_name ?? '—'}</TD>
                  <TD><StatusChip tone={STATUS_TONE[r.status] ?? 'neutral'}>{label(r.status)}</StatusChip></TD>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{date(r.created_at)}</TD>
                  <TD className="whitespace-nowrap text-sm text-gray-600">{r.decided_at ? date(r.decided_at) : '—'}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}
