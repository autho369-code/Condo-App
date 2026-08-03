import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { requireTenant } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { Badge, EmptyState, PageHeader, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ResidentWorkOrdersPage() {
  await requireTenant();
  const supabase = await createClient();
  const { data: workOrders } = await (supabase as any)
    .from('work_orders')
    .select('id, title, category, priority, status, created_at, scheduled_date, completed_date, units(unit_number)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Work orders"
        description="Track maintenance work authorized for your unit."
        actions={<Link href="/resident/requests"><Button><Wrench className="h-4 w-4" /> New request</Button></Link>}
      />
      <Surface padded={false}>
        {(workOrders ?? []).length === 0 ? (
          <EmptyState icon={Wrench} title="No work orders" description="When management converts a service request into a work order, its progress will appear here." />
        ) : (
          <div className="divide-y divide-gray-100">
            {(workOrders ?? []).map((workOrder: any) => (
              <div key={workOrder.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-950">{workOrder.title}</div>
                  <div className="mt-1 text-xs capitalize text-gray-500">Unit {workOrder.units?.unit_number ?? '—'} · {String(workOrder.category ?? 'general').replace(/_/g, ' ')} · Opened {date(workOrder.created_at)}</div>
                  {workOrder.scheduled_date ? <div className="mt-1 text-xs text-gray-600">Scheduled {date(workOrder.scheduled_date, 'long')}</div> : null}
                  {workOrder.completed_date ? <div className="mt-1 text-xs text-emerald-700">Completed {date(workOrder.completed_date, 'long')}</div> : null}
                </div>
                <div className="flex items-center gap-2"><Badge>{workOrder.priority ?? 'normal'}</Badge><Badge status={workOrder.status} /></div>
              </div>
            ))}
          </div>
        )}
      </Surface>
    </div>
  );
}
