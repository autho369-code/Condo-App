import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// ── Status workflow: Reported → Under Review → Notice Sent → Hearing Scheduled → Resolved ──
// DB statuses mapped to display labels and chip tones
type ViolationStatus = 'open' | 'notice_sent' | 'hearing_pending' | 'cured' | 'fined' | 'closed';

const STATUS_OPTIONS: ViolationStatus[] = ['open', 'notice_sent', 'hearing_pending', 'fined', 'cured', 'closed'];

const SEVERITY_OPTIONS = [
  'noise', 'parking', 'pets', 'exterior_modification', 'trash_debris',
  'landscaping', 'common_area_misuse', 'lease_violation', 'assessment_delinquency', 'other',
] as const;

// ── Helpers ──

function formatLabel(value: string | null | undefined): string {
  if (!value) return 'Not set';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusDisplay(status: string | null | undefined): { label: string; tone: Tone } {
  switch (status) {
    case 'open':
      return { label: 'Reported', tone: 'info' };
    case 'notice_sent':
      return { label: 'Notice Sent', tone: 'info' };
    case 'hearing_pending':
      return { label: 'Hearing Scheduled', tone: 'warning' };
    case 'cured':
      return { label: 'Resolved', tone: 'success' };
    case 'closed':
      return { label: 'Resolved', tone: 'success' };
    case 'fined':
      return { label: 'Fined', tone: 'warning' };
    default:
      return { label: formatLabel(status), tone: 'neutral' };
  }
}

function formatCaseNumber(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function isResolvedStatus(status: string | null | undefined): boolean {
  return status === 'cured' || status === 'closed';
}

function isOverdue(row: { cure_deadline?: string | null; due_date?: string | null; status?: string | null }, todayDate: string): boolean {
  if (isResolvedStatus(row.status)) return false;
  const deadline = row.cure_deadline ?? row.due_date;
  return !!deadline && deadline < todayDate;
}

// ── Page ──

export default async function ViolationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    association?: string;
    status?: string;
    severity?: string;
    q?: string;
  }>;
}) {
  await requireStaff();

  const filters = await searchParams;
  const todayDate = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const supabase = await createClient();
  const db = supabase as any;

  // ── Fetch violations + reference lists ──
  const [{ data: associations }, { data: rows }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('violations')
      .select('id, title, association_id, status, violation_type, reported_date, cure_deadline, hearing_at, due_date, fine_amount, closed_at, cured_at, associations(name)')
      .is('archived_at', null)
      .order('reported_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const all = (rows ?? []) as any[];

  // ── Client-side filtering ──
  let filtered = all;
  if (filters.association) {
    filtered = filtered.filter((v: any) => v.association_id === filters.association);
  }
  if (filters.status) {
    if (filters.status === 'all_open') {
      filtered = filtered.filter((v: any) => !isResolvedStatus(v.status));
    } else {
      filtered = filtered.filter((v: any) => v.status === filters.status);
    }
  }
  if (filters.severity) {
    filtered = filtered.filter((v: any) => v.violation_type === filters.severity);
  }
  if (filters.q) {
    const ql = filters.q.toLowerCase();
    filtered = filtered.filter(
      (v: any) =>
        (v.title ?? '').toLowerCase().includes(ql) ||
        String(v.id).toLowerCase().includes(ql) ||
        (v.associations?.name ?? '').toLowerCase().includes(ql),
    );
  }

  // ── Metrics ──
  const openCases = all.filter((v: any) => !isResolvedStatus(v.status)).length;
  const overdue = all.filter((v: any) => isOverdue(v, todayDate)).length;
  const resolvedThisMonth = all.filter(
    (v: any) =>
      isResolvedStatus(v.status) &&
      ((v.closed_at && v.closed_at >= monthStart) || (v.cured_at && v.cured_at >= monthStart)),
  ).length;

  const metrics: Metric[] = [
    {
      label: 'Open Cases',
      value: openCases,
      sublabel: <Link href="/violations?status=all_open" className="text-blue-700 hover:underline">View open queue</Link>,
    },
    {
      label: 'Overdue',
      value: overdue,
      sublabel: 'Past cure deadline',
    },
    {
      label: 'Resolved This Month',
      value: resolvedThisMonth,
      sublabel: 'Cured or closed',
    },
  ];

  // ── Render ──
  return (
    <DataWorkspace
      title="Violations"
      description="Track rule enforcement from observation through notices, hearings, fines, and resolution."
      actions={
        <Link href="/violations/new">
          <Button>New Violation</Button>
        </Link>
      }
      rail={<ViolationsRail />}
    >
      <div className="space-y-6">
        {/* ── METRIC STRIP ── */}
        <MetricStrip metrics={metrics} />

        {/* ── FILTER BAR ── */}
        <FilterBar
          action="/violations"
          searchDefault={filters.q ?? ''}
          searchPlaceholder="Search case number, title, association..."
        >
          <label className="text-xs font-medium uppercase text-gray-500">
            Association
            <select
              name="association"
              defaultValue={filters.association ?? ''}
              className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case"
            >
              <option value="">All</option>
              {(associations ?? []).map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium uppercase text-gray-500">
            Status
            <select
              name="status"
              defaultValue={filters.status ?? ''}
              className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case"
            >
              <option value="">Any</option>
              <option value="all_open">All Open</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{statusDisplay(s).label}</option>
              ))}
            </select>
          </label>

          <label className="text-xs font-medium uppercase text-gray-500">
            Severity
            <select
              name="severity"
              defaultValue={filters.severity ?? ''}
              className="mt-1 h-9 rounded border border-gray-300 bg-white px-3 text-sm normal-case"
            >
              <option value="">Any</option>
              {SEVERITY_OPTIONS.map((s) => (
                <option key={s} value={s}>{formatLabel(s)}</option>
              ))}
            </select>
          </label>
        </FilterBar>

        {/* ── TABLE ── */}
        {filtered.length > 0 ? (
          <Table>
            <THead>
              <TR>
                <TH>Case #</TH>
                <TH>Title</TH>
                <TH>Association</TH>
                <TH>Status</TH>
                <TH>Severity</TH>
                <TH>Reported Date</TH>
                <TH>Cure Deadline</TH>
              </TR>
            </THead>
            <tbody>
              {filtered.map((v: any) => {
                const sd = statusDisplay(v.status);
                return (
                  <TR key={v.id}>
                    <TD className="font-mono text-xs whitespace-nowrap">
                      <Link href={`/violations/${v.id}`} className="text-blue-700 hover:underline">
                        {formatCaseNumber(v.id)}
                      </Link>
                    </TD>
                    <TD className="max-w-xs">
                      <Link href={`/violations/${v.id}`} className="font-medium text-gray-900 hover:underline">
                        {v.title ?? 'Untitled'}
                      </Link>
                    </TD>
                    <TD className="text-sm text-gray-700">{v.associations?.name ?? '—'}</TD>
                    <TD>
                      <StatusChip tone={sd.tone}>{sd.label}</StatusChip>
                      {isOverdue(v, todayDate) && (
                        <span className="ml-1.5">
                          <StatusChip tone="danger">Overdue</StatusChip>
                        </span>
                      )}
                    </TD>
                    <TD className="text-sm capitalize text-gray-600">{formatLabel(v.violation_type)}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{date(v.reported_date)}</TD>
                    <TD className="whitespace-nowrap text-sm text-gray-600">{date(v.cure_deadline)}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <div className="rounded border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-sm text-gray-500">
            No violations match the current filters.
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}

// ── Right Rail: Task Panel ──

function ViolationsRail() {
  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-sm font-semibold text-gray-950">Tasks</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/violations/new" label="New Violation" />
          <RailLink href="/violations?status=all_open" label="Open Queue" />
          <RailLink href="/violations?status=hearing_pending" label="Hearing Queue" />
          <RailLink href="/reports/violation_log" label="Violation Log Report" />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Quick Links</h2>
        <div className="mt-3 grid gap-2">
          <RailLink href="/violations?status=all_open" label="All Open Cases" />
          <RailLink href="/violations?status=notice_sent" label="Notices Sent" />
          <RailLink href="/violations?status=fined" label="Fined Cases" />
          <RailLink href="/violations?status=cured" label="Resolved Cases" />
        </div>
      </section>
      <section className="border-t border-gray-200 pt-5">
        <h2 className="text-sm font-semibold text-gray-950">Status Workflow</h2>
        <div className="mt-3 space-y-1.5 text-xs text-gray-600">
          <WorkflowStep tone="info" label="Reported" />
          <WorkflowStep tone="info" label="Notice Sent" />
          <WorkflowStep tone="warning" label="Hearing Scheduled" />
          <WorkflowStep tone="success" label="Resolved" />
        </div>
      </section>
    </div>
  );
}

function RailLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      {label}
    </Link>
  );
}

function WorkflowStep({ tone, label }: { tone: Tone; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <StatusChip tone={tone}>{label}</StatusChip>
    </div>
  );
}
