import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { normalizeViolationStatusFilter } from '@/lib/violations/filters';
import { buildViolationFilterSummary, isOpenViolationStatus, isOverdueViolation } from '@/lib/violations/queries';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const statusOptions = ['open', 'notice_sent', 'hearing_pending', 'cured', 'fined', 'closed'];
const typeOptions = ['noise', 'parking', 'pets', 'exterior_modification', 'trash_debris', 'landscaping', 'common_area_misuse', 'lease_violation', 'assessment_delinquency', 'other'];

export default async function ViolationsPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string; status?: string; escalation?: string; type?: string; q?: string; observed_from?: string }>;
}) {
  await requireStaff();
  const filters = await searchParams;
  const todayDate = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: associations }, { data: units }, { data: owners }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('units').select('id, unit_number, association_id').is('archived_at', null).order('unit_number').limit(500),
    db.from('owners').select('id, full_name').is('archived_at', null).order('full_name').limit(500),
  ]);

  let query = db
    .from('violations')
    .select('id, title, description, violation_type, status, date_observed, due_date, hearing_date, reported_date, fine_amount, fine_assessed_at, closed_at, cured_at, associations(name), units(unit_number), owners(full_name)')
    .is('archived_at', null)
    .order('date_observed', { ascending: false });

  const normalizedStatus = normalizeViolationStatusFilter(filters.status);
  if (filters.association) query = query.eq('association_id', filters.association);
  if (filters.type) query = query.eq('violation_type', filters.type);
  if (filters.observed_from) query = query.gte('date_observed', filters.observed_from);
  if (filters.q) query = query.ilike('title', `%${filters.q}%`);
  if (normalizedStatus === 'open') query = query.not('status', 'in', '("closed","cured")');
  if (normalizedStatus === 'overdue') query = query.not('status', 'in', '("closed","cured")').lt('due_date', todayDate);
  if (!normalizedStatus && filters.status) query = query.eq('status', filters.status);
  if (filters.escalation === 'hearing') query = query.eq('status', 'hearing_pending');
  if (filters.escalation === 'fined') query = query.eq('status', 'fined');

  const { data: violations } = await query.limit(300);
  const rows = violations ?? [];
  const open = rows.filter((row: any) => isOpenViolationStatus(row.status)).length;
  const overdue = rows.filter((row: any) => isOverdueViolation(row, todayDate)).length;
  const hearing = rows.filter((row: any) => row.status === 'hearing_pending' || row.hearing_date).length;
  const fines = rows.reduce((sum: number, row: any) => sum + Number(row.fine_amount ?? 0), 0);
  const filterSummary = buildViolationFilterSummary({
    associationId: filters.association,
    status: filters.status,
    escalation: filters.escalation,
    type: filters.type,
    ownerQuery: filters.q,
    observedFrom: filters.observed_from,
  });

  return (
    <DataWorkspace
      title={filters.status === 'overdue' ? 'Overdue violations' : filters.status === 'open' ? 'Open violations' : 'Violations'}
      description="Track rule enforcement from observation through notices, hearings, fines, cure history, and attachments."
      actions={
        <>
          <Link href="/violations/new"><Button>New violation</Button></Link>
          <Link href="/calendar/new?type=board_meeting"><Button variant="secondary">Schedule hearing</Button></Link>
        </>
      }
      rail={<ViolationRail />}
    >
      <div className="space-y-6">
        <MetricStrip metrics={[
          { label: 'Open', value: open, sublabel: <Link href="/violations?status=open" className="text-blue-700 hover:underline">Open queue</Link> },
          { label: 'Overdue', value: overdue, sublabel: <Link href="/violations?status=overdue" className="text-blue-700 hover:underline">Past due</Link> },
          { label: 'Hearings', value: hearing, sublabel: 'Pending or scheduled' },
          { label: 'Potential fines', value: money(fines), sublabel: 'Visible records' },
        ]} />

        <FilterBar action="/violations" searchName="q" searchDefault={filters.q ?? ''} searchPlaceholder="Search title, rule, owner, or unit">
          <label className="text-xs font-medium uppercase text-slate-400">Association<select name="association" defaultValue={filters.association ?? ''} className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case"><option value="">All</option>{(associations ?? []).map((row: any) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label className="text-xs font-medium uppercase text-slate-400">Status<select name="status" defaultValue={filters.status ?? ''} className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case"><option value="">Any</option><option value="open">Open lifecycle</option><option value="overdue">Overdue</option>{statusOptions.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}</select></label>
          <label className="text-xs font-medium uppercase text-slate-400">Escalation<select name="escalation" defaultValue={filters.escalation ?? ''} className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case"><option value="">Any</option><option value="hearing">Hearing</option><option value="fined">Fined</option></select></label>
          <label className="text-xs font-medium uppercase text-slate-400">Type<select name="type" defaultValue={filters.type ?? ''} className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case"><option value="">Any</option>{typeOptions.map((type) => <option key={type} value={type}>{formatStatus(type)}</option>)}</select></label>
          <label className="text-xs font-medium uppercase text-slate-400">Observed<input type="date" name="observed_from" defaultValue={filters.observed_from ?? ''} className="mt-1 h-9 rounded border border-gray-300 px-3 text-sm normal-case" /></label>
        </FilterBar>

        {filterSummary.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filterSummary.map((item) => <span key={item} className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-slate-400">{item}</span>)}
          </div>
        )}

        {rows.length > 0 ? (
          <Table>
            <THead><TR><TH>Violation</TH><TH>Association / unit</TH><TH>Observed</TH><TH>Due / hearing</TH><TH>Fine</TH><TH>Status</TH></TR></THead>
            <tbody>
              {rows.map((violation: any) => (
                <TR key={violation.id}>
                  <TD>
                    <Link href={`/violations/${violation.id}`} className="font-medium text-blue-700 hover:underline">{violation.title}</Link>
                    <div className="text-xs text-slate-400">{formatStatus(violation.violation_type)}</div>
                  </TD>
                  <TD>
                    <div className="text-sm text-gray-900">{violation.associations?.name ?? '-'}</div>
                    <div className="text-xs text-slate-400">{violation.units?.unit_number ? `Unit ${violation.units.unit_number}` : 'No unit'}{violation.owners?.full_name ? ` - ${violation.owners.full_name}` : ''}</div>
                  </TD>
                  <TD className="whitespace-nowrap text-sm">{date(violation.date_observed)}</TD>
                  <TD className="text-sm"><div>Due: {date(violation.due_date)}</div><div className="text-xs text-slate-400">Hearing: {date(violation.hearing_date)}</div></TD>
                  <TD className="whitespace-nowrap text-sm tabular-nums">{violation.fine_amount ? money(violation.fine_amount) : '-'}</TD>
                  <TD><ViolationStatus status={violation.status} overdue={isOverdueViolation(violation, todayDate)} /></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-slate-400">
            No violations match the current filters.
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

function ViolationStatus({ status, overdue }: { status: string; overdue: boolean }) {
  if (overdue) return <StatusChip tone="danger">Overdue</StatusChip>;
  if (status === 'closed' || status === 'cured') return <StatusChip tone="success">{formatStatus(status)}</StatusChip>;
  if (status === 'hearing_pending' || status === 'fined') return <StatusChip tone="warning">{formatStatus(status)}</StatusChip>;
  return <StatusChip tone="info">{formatStatus(status)}</StatusChip>;
}

function ViolationRail() {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Compliance tasks</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/violations/new" label="New violation" />
          <RailLink href="/violations?status=overdue" label="Overdue follow-up" />
          <RailLink href="/violations?escalation=hearing" label="Hearing queue" />
          <RailLink href="/reports/violation_log" label="Violation log report" />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Available lookup data</h2>
        <p className="mt-2 text-sm text-slate-400">Owners and units are loaded for draft workflows; outbound notices stay in preview until explicitly sent.</p>
      </section>
    </div>
  );
}

function RailLink({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">{label}</Link>;
}

function formatStatus(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ') : 'Not set';
}
