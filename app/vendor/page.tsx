import Link from 'next/link';
import { Wrench, ShieldAlert, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, SectionTitle, Badge, MetricStrip, Metric, EmptyState, Alert } from '@/components/ui/shell';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const OPEN_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress', 'open'];

export default async function VendorDashboard() {
  const me = await requireVendor();
  const supabase = await createClient();
  const db = supabase as any;

  const todayDate = new Date().toISOString().slice(0, 10);

  const [{ data: vendor }, { data: workOrders }, { data: compliance }, { data: openBills }] = await Promise.all([
    db.from('vendors').select('id, name, trade').eq('id', me.vendor_id).maybeSingle(),
    db.from('work_orders')
      .select('id, number, title, status, priority, scheduled_date, completed_date, created_at, associations(name)')
      .eq('vendor_id', me.vendor_id)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(100),
    db.from('vendor_compliance').select('*').eq('vendor_id', me.vendor_id).maybeSingle(),
    db.from('payable_bills')
      .select('amount, status')
      .eq('vendor_id', me.vendor_id)
      .is('archived_at', null)
      .not('status', 'in', '("paid","void")'),
  ]);

  const wos = workOrders ?? [];
  const open = wos.filter((w: any) => OPEN_STATUSES.includes((w.status ?? '').toLowerCase()));
  const scheduled = open.filter((w: any) => w.scheduled_date);
  const emergencies = open.filter((w: any) => (w.priority ?? '').toLowerCase() === 'emergency');
  const today = open.filter((w: any) => w.scheduled_date === todayDate);
  const inProgress = open.filter((w: any) => (w.status ?? '').toLowerCase() === 'in_progress');
  const newAssignments = open.filter((w: any) => ['new', 'assigned'].includes((w.status ?? '').toLowerCase()));
  const completed = wos.filter((w: any) => ['done', 'completed', 'billed', 'closed'].includes((w.status ?? '').toLowerCase()));
  const pendingPay = (openBills ?? []).reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0);

  // Compliance expirations within 30 days or past
  const soon = Date.now() + 30 * 86400000;
  const expiring: { label: string; date: string; expired: boolean }[] = [];
  const checks: [string, string | null][] = [
    ['Workers comp', compliance?.workers_comp_expiration],
    ['General liability', compliance?.general_liability_expiration],
    ['Auto insurance', compliance?.auto_insurance_expiration],
    ['State license', compliance?.state_license_expiration],
    ['Contract', compliance?.contract_expiration],
  ];
  for (const [label, d] of checks) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (t < soon) expiring.push({ label, date: d, expired: t < Date.now() });
  }

  return (
    <div>
      <PageHeader
        title={`Welcome${vendor?.name ? `, ${vendor.name}` : ''}`}
        description={vendor?.trade ? `Trade: ${vendor.trade.replace(/_/g, ' ')}` : 'Your assigned work at a glance.'}
      />

      {expiring.length > 0 && (
        <Alert tone={expiring.some((e) => e.expired) ? 'danger' : 'warning'} className="mb-5">
          {expiring.map((e) => `${e.label} ${e.expired ? 'expired' : 'expires'} ${date(e.date)}`).join(' · ')}
          {' — '}
          <Link href="/vendor/compliance" className="font-semibold underline underline-offset-2">review compliance</Link>
        </Alert>
      )}

      {emergencies.length > 0 && (
        <Alert tone="danger" className="mb-5">
          {emergencies.length} emergency job{emergencies.length === 1 ? '' : 's'} assigned to you:{' '}
          {emergencies.slice(0, 3).map((e: any) => e.title).join(' · ')} —{' '}
          <Link href="/vendor/work-orders" className="font-semibold underline underline-offset-2">open work orders</Link>
        </Alert>
      )}

      <MetricStrip className="mb-6 lg:grid-cols-4">
        <Metric label="Jobs today" value={today.length} accent="blue" />
        <Metric label="New assignments" value={newAssignments.length} accent="violet" />
        <Metric label="In progress" value={inProgress.length} />
        <Metric label="Emergency" value={emergencies.length} accent={emergencies.length > 0 ? 'red' : undefined} />
        <Metric label="Scheduled" value={scheduled.length} />
        <Metric label="Completed" value={completed.length} sub="recent history" accent="emerald" />
        <Metric label="Pending payment" value={`$${pendingPay.toLocaleString()}`} sub={<Link href="/vendor/payments" className="underline underline-offset-2">payment status</Link>} />
        <Metric label="All assigned" value={wos.length} sub="last 100 shown" />
      </MetricStrip>

      <Surface padded={false}>
        <SectionTitle title="Open work orders" className="px-5 pt-5 sm:px-6" actions={
          <Link href="/vendor/work-orders" className="flex items-center gap-1 text-[13px] font-medium text-blue-600 hover:text-blue-800">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        } />
        {open.length === 0 ? (
          <EmptyState icon={Wrench} title="No open work orders" description="New assignments from your management companies will appear here." />
        ) : (
          <ul className="divide-y divide-gray-50">
            {open.slice(0, 8).map((w: any) => (
              <li key={w.id}>
                <Link href={`/vendor/work-orders/${w.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50/60 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-gray-900">
                      {w.number ? `#${w.number} · ` : ''}{w.title ?? 'Work order'}
                    </div>
                    <div className="truncate text-[12px] text-gray-500">
                      {w.associations?.name ?? '—'}{w.scheduled_date ? ` · scheduled ${date(w.scheduled_date)}` : ''}
                    </div>
                  </div>
                  <Badge status={w.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      {!compliance && (
        <Surface className="mt-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
            <div className="text-[13px] leading-5 text-gray-600">
              No compliance documents on file yet. Keeping your insurance and license dates current helps you stay eligible for assignments.{' '}
              <Link href="/vendor/compliance" className="font-medium text-blue-600 hover:text-blue-800">Add them now</Link>.
            </div>
          </div>
        </Surface>
      )}
    </div>
  );
}
