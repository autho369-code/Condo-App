import { createClient } from '@/lib/supabase/server';
import { requireVendor } from '@/lib/auth/me';
import { PageHeader, Surface, SectionTitle, MetricStrip, Metric } from '@/components/ui/shell';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const DONE_STATUSES = ['done', 'completed', 'billed', 'closed'];
const OPEN_STATUSES = ['new', 'assigned', 'scheduled', 'in_progress'];

export default async function VendorPerformancePage() {
  const me = await requireVendor();
  const supabase = await createClient();
  const db = supabase as any;
  const todayDate = new Date().toISOString().slice(0, 10);

  const { data: wos } = await db
    .from('work_orders')
    .select('id, title, status, priority, created_at, scheduled_date, completed_date')
    .eq('vendor_id', me.vendor_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = wos ?? [];
  const open = rows.filter((w: any) => OPEN_STATUSES.includes((w.status ?? '').toLowerCase()));
  const overdue = open.filter((w: any) => w.scheduled_date && w.scheduled_date < todayDate);
  const done = rows.filter((w: any) => DONE_STATUSES.includes((w.status ?? '').toLowerCase()));
  const resolved = done.filter((w: any) => w.completed_date && w.created_at);

  const avgCompletionDays = resolved.length
    ? resolved.reduce((s: number, w: any) => s + Math.max(0, (new Date(w.completed_date).getTime() - new Date(w.created_at).getTime()) / 86400000), 0) / resolved.length
    : null;

  const withSchedule = done.filter((w: any) => w.completed_date && w.scheduled_date);
  const onTime = withSchedule.filter((w: any) => w.completed_date <= w.scheduled_date).length;
  const onTimeRate = withSchedule.length ? Math.round((onTime / withSchedule.length) * 100) : null;

  const emergenciesDone = resolved.filter((w: any) => (w.priority ?? '').toLowerCase() === 'emergency');
  const emergencyAvgDays = emergenciesDone.length
    ? emergenciesDone.reduce((s: number, w: any) => s + Math.max(0, (new Date(w.completed_date).getTime() - new Date(w.created_at).getTime()) / 86400000), 0) / emergenciesDone.length
    : null;

  const fmtDays = (d: number | null) => (d === null ? '—' : d < 1 ? `${Math.round(d * 24)}h` : `${d.toFixed(1)}d`);

  return (
    <div>
      <PageHeader
        title="Performance"
        description="Your service record across all management companies on Portier369 — the same numbers managers see."
      />

      <MetricStrip className="mb-6 lg:grid-cols-3">
        <Metric label="Jobs completed" value={done.length} accent="emerald" />
        <Metric label="Open jobs" value={open.length} sub={`${overdue.length} overdue`} accent={overdue.length > 0 ? 'amber' : 'blue'} />
        <Metric label="Avg completion time" value={fmtDays(avgCompletionDays)} />
        <Metric label="On-time completion" value={onTimeRate === null ? '—' : `${onTimeRate}%`} sub={withSchedule.length ? `${onTime}/${withSchedule.length} scheduled jobs` : 'No scheduled completions yet'} accent={onTimeRate !== null && onTimeRate >= 80 ? 'emerald' : undefined} />
        <Metric label="Emergency avg response" value={fmtDays(emergencyAvgDays)} sub={emergenciesDone.length ? `${emergenciesDone.length} emergency job${emergenciesDone.length === 1 ? '' : 's'}` : 'No emergency history'} />
      </MetricStrip>

      <Surface padded={false}>
        <SectionTitle title="Recently completed" className="px-5 pt-5 sm:px-6" />
        {resolved.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 sm:px-6">Completed jobs will build your track record here.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {resolved.slice(0, 10).map((w: any) => (
              <li key={w.id} className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
                <span className="truncate text-sm text-gray-900">{w.title}</span>
                <span className="shrink-0 text-[13px] tabular-nums text-gray-500">{date(w.completed_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <p className="mt-4 text-xs leading-5 text-gray-400">
        Metrics are computed from your assigned work orders. Keeping insurance and licenses current on the{' '}
        <a href="/vendor/compliance" className="underline">Compliance</a> page also factors into how management
        companies evaluate vendors.
      </p>
    </div>
  );
}
