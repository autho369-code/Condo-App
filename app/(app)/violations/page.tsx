import Link from 'next/link';
import { Plus, ShieldAlert } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/shell';
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
      sublabel: <Link href="/violations?status=all_open" className="font-medium text-gray-500 transition-colors hover:text-gray-900">View open queue</Link>,
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
          <Button><Plus className="h-4 w-4" /> New violation</Button>
        </Link>
      }
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
          <FilterSelect label="Association" name="association" defaultValue={filters.association ?? ''}>
            <option value="">All</option>
            {(associations ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Status" name="status" defaultValue={filters.status ?? ''}>
            <option value="">Any</option>
            <option value="all_open">All Open</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{statusDisplay(s).label}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Severity" name="severity" defaultValue={filters.severity ?? ''}>
            <option value="">Any</option>
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>{formatLabel(s)}</option>
            ))}
          </FilterSelect>
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
                      <Link href={`/violations/${v.id}`} className="text-gray-700 hover:text-gray-950 hover:underline">
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
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={ShieldAlert}
              title="No violations match the current filters"
              description="Track rule enforcement from observation through notices, hearings, fines, and resolution."
              action={
                <Link href="/violations/new">
                  <Button><Plus className="h-4 w-4" /> New violation</Button>
                </Link>
              }
            />
          </div>
        )}
      </div>
    </DataWorkspace>
  );
}
