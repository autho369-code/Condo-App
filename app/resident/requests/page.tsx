import { AlertTriangle, Wrench } from 'lucide-react';
import { requireTenant } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { Alert, Badge, EmptyState, PageHeader, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { date } from '@/lib/utils';
import { cancelResidentRequest, submitResidentRequest } from '@/app/resident/actions';

export const dynamic = 'force-dynamic';

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function ResidentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; cancelled?: string; error?: string }>;
}) {
  const banner = await searchParams;
  const me = await requireTenant();
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: tenants }, { data: requests }] = await Promise.all([
    db.from('tenants')
      .select('id, unit_id, units(unit_number, buildings(name, associations(name)))')
      .in('unit_id', me.tenant_unit_ids ?? []),
    db.from('service_requests')
      .select('id, number, description, priority, status, permission_to_enter, created_at, work_orders(id, status)')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  const unitOptions = (tenants ?? []).map((tenant: any) => {
    const unit = relation<any>(tenant.units);
    const building = relation<any>(unit?.buildings);
    const association = relation<any>(building?.associations);
    return {
      tenantId: tenant.id,
      unitId: tenant.unit_id,
      label: `${association?.name ?? 'Association'} · ${building?.name ? `${building.name} · ` : ''}Unit ${unit?.unit_number ?? '—'}`,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service requests"
        description="Report a maintenance issue and follow its progress from intake through completion."
      />

      {banner.submitted ? <Alert tone="success">Your request was submitted to management.</Alert> : null}
      {banner.cancelled ? <Alert tone="success">The request was cancelled.</Alert> : null}
      {banner.error ? <Alert>{banner.error}</Alert> : null}

      <Surface>
        <h2 className="text-[15px] font-semibold text-gray-950">Submit a request</h2>
        <p className="mt-1 text-[13px] leading-5 text-gray-500">For fire, gas, an active flood, or immediate danger, call 911 and your building&apos;s emergency line first.</p>
        {unitOptions.length === 0 ? (
          <Alert tone="warning" className="mt-4">Your account is not linked to an active unit. Contact management.</Alert>
        ) : (
          <form action={submitResidentRequest as any} className="mt-5 space-y-5">
            <div>
              <Label htmlFor="unit_id">Unit</Label>
              {unitOptions.length === 1 ? (
                <>
                  <input type="hidden" name="unit_id" value={unitOptions[0].unitId} />
                  <div className="mt-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-800">{unitOptions[0].label}</div>
                </>
              ) : (
                <select id="unit_id" name="unit_id" required className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                  {unitOptions.map((unit: any) => <option key={unit.tenantId} value={unit.unitId}>{unit.label}</option>)}
                </select>
              )}
            </div>
            <div>
              <Label htmlFor="description">What needs attention?</Label>
              <textarea id="description" name="description" required minLength={10} maxLength={10000} rows={5} placeholder="Describe where the issue is, when it started, and anything management should know." className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <select id="priority" name="priority" defaultValue="normal" className="mt-1 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                  <option value="low">Low — minor issue</option>
                  <option value="normal">Normal — standard request</option>
                  <option value="high">High — affects daily use</option>
                  <option value="emergency">Emergency — active damage or safety</option>
                </select>
              </div>
              <div>
                <Label htmlFor="access_notes">Scheduling notes</Label>
                <Input id="access_notes" name="access_notes" maxLength={2000} placeholder="Weekdays after 5, pet in unit, etc." />
              </div>
            </div>
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              <input type="checkbox" name="permission_to_enter" className="mt-0.5 h-4 w-4" />
              <span><span className="font-medium text-gray-900">Permission to enter</span><br /><span className="text-xs leading-5 text-gray-500">Management or its authorized vendor may enter when you are not home.</span></span>
            </label>
            <div className="flex justify-end"><Button type="submit" size="lg"><Wrench className="h-4 w-4" /> Submit request</Button></div>
          </form>
        )}
      </Surface>

      <Surface padded={false}>
        <div className="border-b border-gray-100 px-5 py-4"><h2 className="text-[15px] font-semibold text-gray-950">Request history</h2></div>
        {(requests ?? []).length === 0 ? (
          <EmptyState icon={Wrench} title="No service requests" description="Requests you submit will appear here with their current status." />
        ) : (
          <div className="divide-y divide-gray-100">
            {(requests ?? []).map((request: any) => {
              const workOrder = relation<any>(request.work_orders);
              const canCancel = ['open', 'waiting'].includes(request.status) && !workOrder;
              return (
                <div key={request.id} className="px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-gray-500">{request.number ?? request.id.slice(0, 8)}</span>
                        <Badge status={request.status} />
                        <Badge tone={request.priority === 'emergency' ? 'danger' : request.priority === 'high' ? 'pending' : 'info'}>{request.priority}</Badge>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-800">{request.description}</p>
                      <div className="mt-2 text-xs text-gray-500">Submitted {date(request.created_at)}{request.permission_to_enter ? ' · Permission to enter granted' : ''}</div>
                      {workOrder ? <div className="mt-1 text-xs font-medium text-indigo-700">Work order {String(workOrder.status ?? 'created').replace(/_/g, ' ')}</div> : null}
                    </div>
                    {canCancel ? (
                      <form action={cancelResidentRequest.bind(null, request.id) as any}>
                        <Button type="submit" variant="danger" size="sm">Cancel request</Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Surface>

      <Alert tone="warning" className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        Emergency priority notifies management of urgency but does not replace emergency services or your building&apos;s emergency phone procedure.
      </Alert>
    </div>
  );
}
