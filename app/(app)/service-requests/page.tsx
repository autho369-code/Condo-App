import Link from 'next/link';
import { ArrowUpRight, ClipboardList, Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { requireStaff } from '@/lib/auth/me';
import { ExportActions, type ExportTable } from '@/components/export/export-actions';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';
import { triageServiceRequest } from '@/app/(app)/service-requests/actions';
import { activeWorkOrder, requestKindLabel, responseState } from '@/lib/maintenance/intake';
import { todayInZone } from '@/lib/time/zoned';

export const dynamic = 'force-dynamic';

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function statusTone(status: string): Tone {
  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'neutral';
  if (status === 'waiting') return 'info';
  return 'warning';
}

function priorityTone(priority: string): Tone {
  if (priority === 'emergency') return 'danger';
  if (priority === 'high') return 'warning';
  return 'neutral';
}

function ageInDays(timestamp: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 86400000));
}

export default async function ServiceRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; intake?: string; priority?: string; association_id?: string; error?: string }>;
}) {
  const me = await requireStaff();
  const { q = '', intake = 'open', priority = '', association_id = '', error = '' } = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const OPEN = ['open', 'waiting'];
  const nowIso = new Date().toISOString();
  // Queue predicates run in the database so they see every request, not just
  // the first page (has_open_work_order is kept in sync by a work_orders trigger).
  let listQuery = db.from('service_requests')
    .select('id, number, description, priority, status, source, permission_to_enter, created_at, association_id, unit_id, tenant_id, owner_id, homeowner_id, request_kind, admin_topic, category, duplicate_of, duplicate_reviewed, first_response_due_at, acknowledged_at, associations(name), units(unit_number), tenants:tenant_id(first_name,last_name,email), owners:owner_id(full_name,email), homeowners:homeowner_id(full_name,email), work_orders(id,number,status)')
    .is('archived_at', null);
  if (intake === 'overdue') listQuery = listQuery.in('status', OPEN).is('acknowledged_at', null).lt('first_response_due_at', nowIso);
  else if (intake === 'questions') listQuery = listQuery.in('status', OPEN).eq('request_kind', 'admin');
  else if (intake === 'duplicates') listQuery = listQuery.in('status', OPEN).not('duplicate_of', 'is', null).eq('duplicate_reviewed', false);
  else if (intake === 'completed' || intake === 'cancelled') listQuery = listQuery.eq('status', intake);
  else if (intake === 'new') listQuery = listQuery.in('status', OPEN).eq('has_open_work_order', false);
  else if (intake === 'triaged') listQuery = listQuery.in('status', OPEN).eq('has_open_work_order', true);
  else if (intake !== 'all') listQuery = listQuery.in('status', OPEN);
  if (priority) listQuery = listQuery.eq('priority', priority);
  if (association_id) listQuery = listQuery.eq('association_id', association_id);

  const openCount = (build: (query: any) => any) =>
    build(db.from('service_requests').select('id', { count: 'exact', head: true }).is('archived_at', null).in('status', OPEN));

  const [{ data: requestRows, error: listError }, { data: associations }, { data: openRows }, overdueRes, questionRes, duplicateRes, emergencyRes, newRes, triagedRes] = await Promise.all([
    listQuery.order('priority', { ascending: false }).order('created_at', { ascending: false }).limit(500),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    // Every open request for the average age (one request stops at 1,000 rows).
    fetchAllRows<any>(() => db.from('service_requests').select('id, created_at').is('archived_at', null).in('status', OPEN).order('created_at').order('id')).then((r) => ({ data: r.rows })),
    openCount((query) => query.is('acknowledged_at', null).lt('first_response_due_at', nowIso)),
    openCount((query) => query.eq('request_kind', 'admin')),
    openCount((query) => query.not('duplicate_of', 'is', null).eq('duplicate_reviewed', false)),
    openCount((query) => query.eq('priority', 'emergency')),
    openCount((query) => query.eq('has_open_work_order', false)),
    openCount((query) => query.eq('has_open_work_order', true)),
  ]);

  const all = (requestRows ?? []) as any[];
  const open = (openRows ?? []) as any[];
  const isOpen = (request: any) => OPEN.includes(request.status);
  const isDuplicate = (request: any) => Boolean(request.duplicate_of) && !request.duplicate_reviewed && isOpen(request);
  const now = Date.now();
  let filtered = all;
  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter((request) => {
      const tenant = one<any>(request.tenants);
      const owner = one<any>(request.owners) ?? one<any>(request.homeowners);
      const searchable = [
        request.number,
        request.description,
        request.associations?.name,
        request.units?.unit_number,
        tenant ? `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}` : null,
        owner?.full_name,
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(needle);
    });
  }

  const newCount = newRes.count ?? 0;
  const triagedCount = triagedRes.count ?? 0;
  const averageAge = open.length === 0 ? 0 : Math.round(open.reduce((sum, request) => sum + ageInDays(request.created_at), 0) / open.length);
  const emergencyCount = emergencyRes.count ?? 0;
  const overdueCount = overdueRes.count ?? 0;
  const questionCount = questionRes.count ?? 0;
  const duplicateCount = duplicateRes.count ?? 0;

  const exportTable: ExportTable = {
    columns: [
      { header: '#' },
      { header: 'Requestor' },
      { header: 'Association' },
      { header: 'Unit' },
      { header: 'Priority' },
      { header: 'Status' },
      { header: 'Submitted' },
      { header: 'Description' },
    ],
    rows: filtered.map((request) => {
      const tenant = one<any>(request.tenants);
      const owner = one<any>(request.owners) ?? one<any>(request.homeowners);
      return [
        request.number ?? request.id.slice(0, 8),
        tenant ? `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() : owner?.full_name ?? 'Resident',
        request.associations?.name ?? '—',
        request.units?.unit_number ?? '—',
        request.priority,
        request.status,
        date(request.created_at),
        request.description,
      ];
    }),
  };

  return (
    <DataWorkspace
      title="Service Requests"
      description="Triage resident-reported issues, convert approved requests into work orders, and maintain one accountable intake queue."
      actions={(
        <ExportActions
          documentTitle="Service Requests"
          companyName={me.portfolio?.company_name ?? 'Management company'}
          filename={`service-requests-${todayInZone()}`}
          tables={[exportTable]}
        />
      )}
    >
      <div className="space-y-6">
        {error ? <Alert>{error}</Alert> : null}
        {listError ? <Alert title="Requests could not be loaded">{listError.message}</Alert> : null}
        <MetricStrip metrics={[
          { label: 'Awaiting triage', value: newCount, sublabel: `${triagedCount} in work orders · avg age ${averageAge}d` },
          { label: 'Reply overdue', value: overdueCount, sublabel: 'Past the first-response time' },
          { label: 'Emergencies', value: emergencyCount, sublabel: 'Open, reply within 2 hours' },
          { label: 'Questions, not repairs', value: questionCount, sublabel: duplicateCount ? `${duplicateCount} possible duplicate${duplicateCount === 1 ? '' : 's'}` : 'Answer and close' },
        ]} />

        <FilterBar action="/service-requests" searchDefault={q} searchPlaceholder="Search requests, residents, units">
          <FilterSelect label="Queue" name="intake" defaultValue={intake}>
            <option value="open">Open requests</option>
            <option value="new">Awaiting triage</option>
            <option value="overdue">Reply overdue</option>
            <option value="questions">Questions, not repairs</option>
            <option value="duplicates">Possible duplicates</option>
            <option value="triaged">Converted to work order</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All requests</option>
          </FilterSelect>
          <FilterSelect label="Priority" name="priority" defaultValue={priority}>
            <option value="">All priorities</option>
            <option value="emergency">Emergency</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </FilterSelect>
          <FilterSelect label="Association" name="association_id" defaultValue={association_id}>
            <option value="">All associations</option>
            {(associations ?? []).map((association: any) => <option key={association.id} value={association.id}>{association.name}</option>)}
          </FilterSelect>
        </FilterBar>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white">
            <EmptyState icon={ClipboardList} title="No matching service requests" description="New owner and resident requests will appear here for manager triage." />
          </div>
        ) : (
          <Table>
            <THead><TR><TH>Request</TH><TH>Resident</TH><TH>Property</TH><TH>Priority</TH><TH>Status</TH><TH>Age</TH><TH className="text-right">Action</TH></TR></THead>
            <tbody>
              {filtered.map((request) => {
                const tenant = one<any>(request.tenants);
                const owner = one<any>(request.owners) ?? one<any>(request.homeowners);
                const workOrder = activeWorkOrder(request);
                const requestor = tenant ? `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() : owner?.full_name ?? 'Resident';
                return (
                  <TR key={request.id}>
                    <TD className="max-w-md">
                      <div className="font-mono text-[12.5px] text-gray-400">#{request.number ?? request.id.slice(0, 8)}</div>
                      <Link href={`/service-requests/${request.id}`} className="mt-1 line-clamp-2 font-medium leading-5 text-gray-900 hover:underline">{request.description}</Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <StatusChip tone={request.request_kind === 'admin' ? 'info' : 'neutral'}>{requestKindLabel(request.request_kind, request.admin_topic, request.category)}</StatusChip>
                        {isDuplicate(request) ? <StatusChip tone="warning">Possible duplicate</StatusChip> : null}
                        <span className="text-[12.5px] capitalize text-gray-400">{String(request.source).replace(/_/g, ' ')}</span>
                      </div>
                    </TD>
                    <TD><div className="font-medium text-gray-900">{requestor}</div><div className="mt-0.5 text-xs text-gray-400">{tenant ? 'Tenant' : 'Owner'}</div></TD>
                    <TD><div className="font-medium text-gray-900">{request.associations?.name ?? '—'}</div><div className="mt-0.5 text-xs text-gray-400">Unit {request.units?.unit_number ?? '—'}</div></TD>
                    <TD><StatusChip tone={priorityTone(request.priority)}>{request.priority}</StatusChip></TD>
                    <TD><StatusChip tone={statusTone(request.status)}>{workOrder ? 'In work order' : request.status}</StatusChip></TD>
                    <TD>
                      <div className="tabular-nums text-gray-900">{ageInDays(request.created_at)}d</div>
                      <div className="mt-0.5 text-xs text-gray-400">{date(request.created_at)}</div>
                      {(() => { const state = responseState(request, now); return state && !request.acknowledged_at ? <div className="mt-1"><StatusChip tone={state.tone}>{state.label}</StatusChip></div> : null; })()}
                    </TD>
                    <TD className="text-right">
                      {workOrder ? (
                        <Link href={`/work-orders/${workOrder.id}`}><Button size="sm" variant="secondary">Open <ArrowUpRight className="h-3.5 w-3.5" /></Button></Link>
                      ) : isOpen(request) && (request.request_kind === 'admin' || isDuplicate(request)) ? (
                        <Link href={`/service-requests/${request.id}`}><Button size="sm" variant="secondary">{isDuplicate(request) ? 'Review' : 'Answer'}</Button></Link>
                      ) : isOpen(request) ? (
                        <form action={triageServiceRequest.bind(null, request.id)}>
                          <Button type="submit" size="sm"><Wrench className="h-3.5 w-3.5" /> Create work order</Button>
                        </form>
                      ) : <span className="text-[13px] text-gray-500">No action</span>}
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}
