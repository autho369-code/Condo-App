import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

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
  searchParams: Promise<{ association?: string; status?: string; q?: string }>;
}) {
  await requireStaff();
  const filters = await searchParams;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: associations }, { data: rows }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('architectural_requests')
      .select('id, title, category, status, created_at, decided_at, association_id, associations(name), units(unit_number), owners(full_name)')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const all = (rows ?? []) as any[];

  let filtered = all;
  if (filters.association) filtered = filtered.filter((r) => r.association_id === filters.association);
  if (filters.status) {
    filtered = filters.status === 'open'
      ? filtered.filter((r) => OPEN_STATUSES.includes(r.status))
      : filtered.filter((r) => r.status === filters.status);
  }
  if (filters.q) {
    const ql = filters.q.toLowerCase();
    filtered = filtered.filter((r) =>
      (r.title ?? '').toLowerCase().includes(ql) ||
      (r.associations?.name ?? '').toLowerCase().includes(ql) ||
      (r.owners?.full_name ?? '').toLowerCase().includes(ql));
  }

  const awaiting = all.filter((r) => OPEN_STATUSES.includes(r.status)).length;
  const approvedThisMonth = all.filter((r) => r.status === 'approved' && r.decided_at && r.decided_at >= monthStart).length;
  const deniedThisMonth = all.filter((r) => r.status === 'denied' && r.decided_at && r.decided_at >= monthStart).length;

  const metrics: Metric[] = [
    { label: 'Awaiting Review', value: awaiting, sublabel: <Link href="/architectural-reviews?status=open" className="font-medium text-gray-500 transition-colors hover:text-gray-900">View queue</Link> },
    { label: 'Approved This Month', value: approvedThisMonth, sublabel: 'Decisions recorded' },
    { label: 'Denied This Month', value: deniedThisMonth, sublabel: 'Decisions recorded' },
  ];

  return (
    <DataWorkspace
      title="Architectural Reviews"
      description="Review homeowner modification requests, discuss in-thread, and record the board's decision."
    >
      <div className="space-y-6">
        <MetricStrip metrics={metrics} />

        <FilterBar action="/architectural-reviews" searchDefault={filters.q ?? ''} searchPlaceholder="Search title, association, homeowner...">
          <FilterSelect label="Association" name="association" defaultValue={filters.association ?? ''}>
            <option value="">All</option>
            {(associations ?? []).map((a: any) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </FilterSelect>
          <FilterSelect label="Status" name="status" defaultValue={filters.status ?? ''}>
            <option value="">Any</option>
            <option value="open">Awaiting review</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="more_info">More info</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="withdrawn">Withdrawn</option>
          </FilterSelect>
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
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}
