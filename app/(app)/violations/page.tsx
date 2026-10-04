import Link from 'next/link';
import { BookOpenCheck, Inbox, Mail, Plus, ShieldAlert, Smartphone } from 'lucide-react';
import { ExportActions, type ExportTable } from '@/components/export/export-actions';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip, type Metric } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { SelectAllCheckbox } from '@/components/ui/select-all';
import { bulkViolationAction } from '@/lib/rpcs/violation-rules';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';
import { todayInZone } from '@/lib/time/zoned';

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

function ruleLabel(rule: { rule_number?: string | null; title?: string | null } | null | undefined): string {
  if (!rule?.title) return '—';
  return rule.rule_number ? `${rule.rule_number} · ${rule.title}` : rule.title;
}

function formatCaseNumber(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function uuidFromHex(h: string) {
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function isResolvedStatus(status: string | null | undefined): boolean {
  return status === 'cured' || status === 'closed';
}

function isOverdue(row: { cure_deadline?: string | null; due_date?: string | null; status?: string | null }, todayDate: string): boolean {
  if (isResolvedStatus(row.status)) return false;
  const deadline = row.cure_deadline ?? row.due_date;
  return !!deadline && deadline < todayDate;
}

function isFollowUpDue(row: { next_followup_on?: string | null; status?: string | null }, todayDate: string): boolean {
  return !isResolvedStatus(row.status) && !!row.next_followup_on && row.next_followup_on <= todayDate;
}

// ── Page ──

export default async function ViolationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    association?: string;
    status?: string;
    severity?: string;
    rule?: string;
    from?: string;
    to?: string;
    q?: string;
    error?: string;
    saved?: string;
  }>;
}) {
  const me = await requireStaff();

  const filters = await searchParams;
  // "Today" in the association's time zone (UTC rolled over at 7 PM Central).
  const todayDate = todayInZone();
  const monthStart = `${todayDate.slice(0, 8)}01`;

  const supabase = await createClient();
  const db = supabase as any;
  const isDate = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const dateFrom = isDate(filters.from) ? filters.from! : '';
  const dateTo = isDate(filters.to) ? filters.to! : '';
  const ruleId = filters.rule && /^[0-9a-f-]{36}$/i.test(filters.rule) ? filters.rule : '';

  let violationsQuery = db.from('violations')
    .select('id, title, association_id, status, violation_type, reported_date, cure_deadline, hearing_at, due_date, fine_amount, fines_total, next_followup_on, current_step, hearing_requested_at, closed_at, cured_at, associations(name), units!violations_unit_id_fkey(unit_number), owners!violations_owner_id_fkey(full_name), house_rules!violations_house_rule_id_fkey(rule_number, title)')
    .is('archived_at', null);
  // Filters run in the query, so the 500-row window holds matching cases
  // (filtering 500 newest rows afterwards dropped older open cases).
  if (filters.association) violationsQuery = violationsQuery.eq('association_id', filters.association);
  if (filters.severity) violationsQuery = violationsQuery.eq('violation_type', filters.severity);
  if (ruleId) violationsQuery = violationsQuery.eq('house_rule_id', ruleId);
  // Reported date, falling back to the observed date for cases without one.
  if (dateFrom) violationsQuery = violationsQuery.or(`reported_date.gte.${dateFrom},and(reported_date.is.null,date_observed.gte.${dateFrom})`);
  if (dateTo) violationsQuery = violationsQuery.or(`reported_date.lte.${dateTo},and(reported_date.is.null,date_observed.lte.${dateTo})`);
  if (filters.status === 'overdue') {
    violationsQuery = violationsQuery
      .or(`cure_deadline.lt.${todayDate},and(cure_deadline.is.null,due_date.lt.${todayDate})`)
      .not('status', 'in', '("cured","closed")');
  } else if (filters.status === 'all_open') {
    violationsQuery = violationsQuery.not('status', 'in', '("cured","closed")');
  } else if (filters.status === 'followup_due') {
    violationsQuery = violationsQuery.not('status', 'in', '("cured","closed")').lte('next_followup_on', todayDate);
  } else if (filters.status) {
    violationsQuery = violationsQuery.eq('status', filters.status);
  }
  if (filters.q) {
    // Title, association, homeowner or unit number.
    const term = filters.q.replace(/[%_,()*"\\]/g, ' ').trim();
    if (term) {
      const [{ data: assocMatches }, { data: ownerMatches }, { data: unitMatches }] = await Promise.all([
        db.from('associations').select('id').ilike('name', `%${term}%`).limit(200),
        db.from('owners').select('id').ilike('full_name', `%${term}%`).limit(200),
        db.from('units').select('id').ilike('unit_number', term).limit(200),
      ]);
      const ids = ((assocMatches ?? []) as { id: string }[]).map((a) => a.id);
      const ownerIds = ((ownerMatches ?? []) as { id: string }[]).map((o) => o.id);
      const unitIds = ((unitMatches ?? []) as { id: string }[]).map((u) => u.id);
      // A case number is the first 8 hex digits of the id: match it as an id
      // range (uuid columns cannot be pattern-matched through the API).
      const hex = term.replace(/^#/, '').toLowerCase();
      const caseRange = /^[0-9a-f]{4,8}$/.test(hex)
        ? `and(id.gte.${uuidFromHex(hex.padEnd(32, '0'))},id.lte.${uuidFromHex(hex.padEnd(32, 'f'))})`
        : null;
      violationsQuery = violationsQuery.or(
        [
          `title.ilike.*${term}*`,
          ids.length ? `association_id.in.(${ids.join(',')})` : null,
          ownerIds.length ? `owner_id.in.(${ownerIds.join(',')})` : null,
          unitIds.length ? `unit_id.in.(${unitIds.join(',')})` : null,
          caseRange,
        ].filter(Boolean).join(','),
      );
    }
  }
  violationsQuery = violationsQuery
    .order('reported_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500);

  // ── Fetch violations + reference lists ──
  // The tiles are counted in the database so they are the same whichever
  // view is open (the overdue view narrows the list query) and are not capped
  // by the 500-row list.
  const openFilter = '("cured","closed")';
  const [{ data: associations }, { data: rules }, { data: rows }, { count: openCount }, { count: overdueCount }, { count: followUpCount }, { count: resolvedCount }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    (() => {
      let q = db.from('house_rules').select('id, association_id, rule_number, title').is('archived_at', null).order('rule_number').order('title');
      if (filters.association) q = q.eq('association_id', filters.association);
      return q.limit(500);
    })(),
    violationsQuery,
    db.from('violations').select('id', { count: 'exact', head: true }).is('archived_at', null).not('status', 'in', openFilter),
    db.from('violations').select('id', { count: 'exact', head: true }).is('archived_at', null).not('status', 'in', openFilter)
      .or(`cure_deadline.lt.${todayDate},and(cure_deadline.is.null,due_date.lt.${todayDate})`),
    db.from('violations').select('id', { count: 'exact', head: true }).is('archived_at', null).not('status', 'in', openFilter)
      .lte('next_followup_on', todayDate),
    db.from('violations').select('id', { count: 'exact', head: true }).is('archived_at', null).in('status', ['cured', 'closed'])
      .or(`closed_at.gte.${monthStart},cured_at.gte.${monthStart}`),
  ]);

  // Bulk actions return to the same filtered view.
  const backParams = new URLSearchParams();
  for (const k of ['association', 'status', 'severity', 'rule', 'from', 'to', 'q'] as const) {
    if (filters[k]) backParams.set(k, filters[k]!);
  }
  const backHref = `/violations${backParams.size ? `?${backParams}` : ''}`;

  // Every filter runs in the query above.
  const filtered = (rows ?? []) as any[];

  // ── Metrics ──
  const openCases = openCount ?? 0;
  const overdue = overdueCount ?? 0;
  const followUpDue = followUpCount ?? 0;
  const resolvedThisMonth = resolvedCount ?? 0;

  const metrics: Metric[] = [
    {
      label: 'Open Cases',
      value: openCases,
      sublabel: <Link href="/violations?status=all_open" className="font-medium text-gray-500 transition-colors hover:text-gray-900">View open queue</Link>,
    },
    {
      label: 'Follow-up Due',
      value: followUpDue,
      sublabel: <Link href="/violations?status=followup_due" className="font-medium text-gray-500 transition-colors hover:text-gray-900">Work the queue</Link>,
    },
    {
      label: 'Overdue',
      value: overdue,
      sublabel: <Link href="/violations?status=overdue" className="font-medium text-gray-500 transition-colors hover:text-gray-900">Past cure deadline</Link>,
    },
    {
      label: 'Resolved This Month',
      value: resolvedThisMonth,
      sublabel: 'Cured or closed',
    },
  ];

  // ── Export (mirrors the on-screen table, same filters) ──
  const companyName = me.portfolio?.company_name ?? 'Management company';
  const exportStamp = new Date().toISOString().slice(0, 10);
  const exportTable: ExportTable = {
    columns: [
      { header: 'Case #' },
      { header: 'Title' },
      { header: 'Association' },
      { header: 'Unit' },
      { header: 'Homeowner' },
      { header: 'Rule' },
      { header: 'Status' },
      { header: 'Type' },
      { header: 'Reported Date' },
      { header: 'Cure Deadline' },
    ],
    rows: filtered.map((v: any) => {
      const sd = statusDisplay(v.status);
      return [
        formatCaseNumber(v.id),
        v.title ?? 'Untitled',
        v.associations?.name ?? '—',
        v.units?.unit_number ?? '—',
        v.owners?.full_name ?? '—',
        ruleLabel(v.house_rules),
        isOverdue(v, todayDate) ? `${sd.label} (Overdue)` : sd.label,
        formatLabel(v.violation_type),
        date(v.reported_date),
        date(v.cure_deadline),
      ];
    }),
  };

  const [{ count: lettersToMail }, { count: reportsToReview }] = await Promise.all([
    db.from('violation_letters').select('id', { count: 'exact', head: true }).eq('mail_status', 'to_mail'),
    db.from('violation_cases').select('id', { count: 'exact', head: true }).is('archived_at', null).eq('status', 'reported'),
  ]);

  // ── Render ──
  return (
    <DataWorkspace
      title="Violations"
      description="Track rule enforcement from observation through notices, hearings, fines, and resolution."
      actions={
        <>
          <ExportActions
            documentTitle="Violations"
            companyName={companyName}
            filename={`violations-${exportStamp}`}
            tables={[exportTable]}
          />
          <Link href="/violations/reports">
            <Button variant="secondary"><Inbox className="h-4 w-4" /> Resident reports{reportsToReview ? ` (${reportsToReview})` : ''}</Button>
          </Link>
          <Link href="/violations/letters">
            <Button variant="secondary"><Mail className="h-4 w-4" /> Letters to mail{lettersToMail ? ` (${lettersToMail})` : ''}</Button>
          </Link>
          <Link href="/violations/rules">
            <Button variant="secondary"><BookOpenCheck className="h-4 w-4" /> Rules & fines</Button>
          </Link>
          <Link href="/violations/field">
            <Button variant="secondary"><Smartphone className="h-4 w-4" /> Field capture</Button>
          </Link>
          <Link href="/violations/new">
            <Button><Plus className="h-4 w-4" /> New violation</Button>
          </Link>
        </>
      }
    >
      <div className="space-y-6">
        {filters.error && <Alert tone="danger" title="Bulk action:">{filters.error}</Alert>}
        {filters.saved && <Alert tone="success">{filters.saved}</Alert>}
        {/* ── METRIC STRIP ── */}
        <MetricStrip metrics={metrics} />

        {/* ── FILTER BAR ── */}
        <FilterBar
          action="/violations"
          searchDefault={filters.q ?? ''}
          searchPlaceholder="Search case #, title, homeowner, unit..."
        >
          <FilterSelect label="Association" name="association" defaultValue={filters.association ?? ''}>
            <option value="">All</option>
            {(associations ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Status" name="status" defaultValue={filters.status ?? ''}>
            <option value="">Any</option>
            <option value="followup_due">Follow-up due</option>
            <option value="overdue">Past cure date</option>
            <option value="all_open">All Open</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{statusDisplay(s).label}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Rule" name="rule" defaultValue={ruleId}>
            <option value="">Any</option>
            {((rules ?? []) as any[]).map((r) => (
              <option key={r.id} value={r.id}>{ruleLabel(r)}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Type" name="severity" defaultValue={filters.severity ?? ''}>
            <option value="">Any</option>
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>{formatLabel(s)}</option>
            ))}
          </FilterSelect>

          <label className="text-[12px] font-medium text-gray-500">
            Reported from
            <input type="date" name="from" defaultValue={dateFrom} className="mt-1 block h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </label>
          <label className="text-[12px] font-medium text-gray-500">
            To
            <input type="date" name="to" defaultValue={dateTo} className="mt-1 block h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm font-normal text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </label>
        </FilterBar>

        {/* ── TABLE ── */}
        {filtered.length > 0 ? (
          <form action={bulkViolationAction} className="space-y-3">
          <input type="hidden" name="back" value={backHref} />
          <div className="flex flex-col gap-2 rounded-2xl border border-gray-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center">
            <span className="text-[13px] text-gray-500">With selected:</span>
            <select name="bulk_action" defaultValue="advance" aria-label="Bulk action" className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
              <option value="advance">Record next follow-up step</option>
              <option value="cured">Mark corrected</option>
            </select>
            <Button type="submit" variant="secondary">Apply</Button>
            <span className="text-[12px] text-gray-400 sm:ml-auto">Fines still respect each association&apos;s hearing rules; blocked rows are reported.</span>
          </div>
          <Table>
            <THead>
              <TR>
                <TH className="w-8"><SelectAllCheckbox targetName="violation_ids" defaultChecked={false} /></TH>
                <TH>Case #</TH>
                <TH>Title</TH>
                <TH>Association</TH>
                <TH>Unit / Homeowner</TH>
                <TH>Rule</TH>
                <TH>Status</TH>
                <TH>Type</TH>
                <TH>Reported Date</TH>
                <TH>Cure Deadline</TH>
                <TH>Next Follow-up</TH>
              </TR>
            </THead>
            <tbody>
              {filtered.map((v: any) => {
                const sd = statusDisplay(v.status);
                return (
                  <TR key={v.id}>
                    <TD>{!isResolvedStatus(v.status) && <input type="checkbox" name="violation_ids" value={v.id} aria-label={`Select ${v.title ?? 'violation'}`} className="h-4 w-4 rounded border-gray-300" />}</TD>
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
                    <TD className="whitespace-nowrap text-sm text-gray-700">
                      {v.units?.unit_number ?? '—'}
                      {v.owners?.full_name && <div className="text-xs text-gray-500">{v.owners.full_name}</div>}
                    </TD>
                    <TD className="max-w-[14rem] text-sm text-gray-600">{ruleLabel(v.house_rules)}</TD>
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
                    <TD className="whitespace-nowrap text-sm text-gray-600">
                      {isResolvedStatus(v.status) ? '—' : v.next_followup_on ? date(v.next_followup_on) : '—'}
                      {isFollowUpDue(v, todayDate) && <span className="ml-1.5"><StatusChip tone="warning">Due</StatusChip></span>}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
          </form>
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
