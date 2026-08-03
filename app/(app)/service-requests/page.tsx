import Link from 'next/link';
import { ArrowUpRight, ClipboardList, Wrench } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
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

  const [{ data: requestRows }, { data: associations }] = await Promise.all([
    db.from('service_requests')
      .select('id, number, description, priority, status, source, permission_to_enter, created_at, association_id, unit_id, tenant_id, owner_id, homeowner_id, associations(name), units(unit_number), tenants:tenant_id(first_name,last_name,email), owners:owner_id(full_name,email), homeowners:homeowner_id(full_name,email), work_orders(id,number,status)')
      .is('archived_at', null)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);

  const all = (requestRows ?? []) as any[];
  let filtered = all.filter((request) => {
    const workOrder = one<any>(request.work_orders);
    if (intake === 'new') return !workOrder && !['completed', 'cancelled'].includes(request.status);
    if (intake === 'triaged') return Boolean(workOrder) && !['completed', 'cancelled'].includes(request.status);
    if (intake === 'completed') return request.status === 'completed';
    if (intake === 'cancelled') return request.status === 'cancelled';
    if (intake === 'all') return true;
    return !['completed', 'cancelled'].includes(request.status);
  });
  if (priority) filtered = filtered.filter((request) => request.priority === priority);
  if (association_id) filtered = filtered.filter((request) => request.association_id === association_id);
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

  const newCount = all.filter((request) => !one(request.work_orders) && !['completed', 'cancelled'].includes(request.status)).length;
  const emergencyCount = all.filter((request) => request.priority === 'emergency' && !['completed', 'cancelled'].includes(request.status)).length;
  const triagedCount = all.filter((request) => one(request.work_orders) && !['completed', 'cancelled'].includes(request.status)).length;
  const averageAge = all.length === 0 ? 0 : Math.round(all.reduce((sum, request) => sum + ageInDays(request.created_at), 0) / all.length);

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
          filename={`service-requests-${new Date().toISOString().slice(0, 10)}`}
          tables={[exportTable]}
        />
      )}
    >
      <div className="space-y-6">
        {error ? <Alert>{error}</Alert> : null}
        <MetricStrip metrics={[
          { label: 'Awaiting triage', value: newCount, sublabel: 'Needs manager review' },
          { label: 'Emergencies', value: emergencyCount, sublabel: 'Open urgent requests' },
          { label: 'In work orders', value: triagedCount, sublabel: 'Dispatched or active' },
          { label: 'Average age', value: `${averageAge}d`, sublabel: 'All requests' },
        ]} />

        <FilterBar action="/service-requests" searchDefault={q} searchPlaceholder="Search requests, residents, units">
          <FilterSelect label="Queue" name="intake" defaultValue={intake}>
            <option value="open">Open requests</option>
            <option value="new">Awaiting triage</option>
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
                const workOrder = one<any>(request.work_orders);
                const requestor = tenant ? `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() : owner?.full_name ?? 'Resident';
                return (
                  <TR key={request.id}>
                    <TD className="max-w-md">
                      <div className="font-mono text-[11px] text-gray-400">{request.number ?? request.id.slice(0, 8)}</div>
                      <div className="mt-1 line-clamp-2 font-medium leading-5 text-gray-900">{request.description}</div>
                      <div className="mt-1 text-[11px] capitalize text-gray-400">{String(request.source).replace(/_/g, ' ')}</div>
                    </TD>
                    <TD><div className="font-medium text-gray-900">{requestor}</div><div className="mt-0.5 text-xs text-gray-400">{tenant ? 'Tenant' : 'Owner'}</div></TD>
                    <TD><div className="font-medium text-gray-900">{request.associations?.name ?? '—'}</div><div className="mt-0.5 text-xs text-gray-400">Unit {request.units?.unit_number ?? '—'}</div></TD>
                    <TD><StatusChip tone={priorityTone(request.priority)}>{request.priority}</StatusChip></TD>
                    <TD><StatusChip tone={statusTone(request.status)}>{workOrder ? 'In work order' : request.status}</StatusChip></TD>
                    <TD><div className="tabular-nums text-gray-900">{ageInDays(request.created_at)}d</div><div className="mt-0.5 text-xs text-gray-400">{date(request.created_at)}</div></TD>
                    <TD className="text-right">
                      {workOrder ? (
                        <Link href={`/work-orders/${workOrder.id}`}><Button size="sm" variant="secondary">Open <ArrowUpRight className="h-3.5 w-3.5" /></Button></Link>
                      ) : !['completed', 'cancelled'].includes(request.status) ? (
                        <form action={triageServiceRequest.bind(null, request.id)}>
                          <Button type="submit" size="sm"><Wrench className="h-3.5 w-3.5" /> Create work order</Button>
                        </form>
                      ) : <span className="text-xs text-gray-400">No action</span>}
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
