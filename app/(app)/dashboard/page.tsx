import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { HealthScoreGauge } from '@/components/command-center/health-score';
import { TodaysPriorities } from '@/components/command-center/today-priorities';

export const dynamic = 'force-dynamic';

export default async function CommandCenterPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  if (me.is_full_access_staff && me.portfolio?.id && process.env.LOCAL_PREVIEW_MODE !== 'true') {
    const { count } = await db
      .from('associations')
      .select('id', { count: 'exact', head: true })
      .eq('portfolio_id', me.portfolio.id);
    if ((count ?? 0) === 0) redirect('/onboard');
  }

  const todayDate = new Date().toISOString().slice(0, 10);

  const [
    { count: openViolations },
    { count: openWorkOrders },
    { count: pendingBills },
    { count: upcomingHearings },
    { count: boardRequests },
    { count: expiringContracts },
  ] = await Promise.all([
    db.from('violation_cases').select('id', { count: 'exact', head: true })
      .not('status', 'in', '("closed","cured","dismissed")'),
    db.from('work_orders').select('id', { count: 'exact', head: true })
      .not('status', 'in', '("completed","cancelled")'),
    db.from('payable_bills').select('id', { count: 'exact', head: true })
      .eq('status', 'pending_approval'),
    db.from('violation_cases').select('id', { count: 'exact', head: true })
      .eq('status', 'hearing_pending'),
    db.from('approval_requests').select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    db.from('vendors').select('id', { count: 'exact', head: true })
      .lte('insurance_expiry', new Date(Date.now() + 30 * 86400000).toISOString()),
  ]);

  const kpis = [
    { label: 'Open Violations', value: openViolations ?? 0, color: 'bg-red-400', link: '/violations' },
    { label: 'Open Work Orders', value: openWorkOrders ?? 0, color: 'bg-blue-400', link: '/work-orders' },
    { label: 'Bills Pending', value: pendingBills ?? 0, color: 'bg-amber-400', link: '/bills' },
    { label: 'Upcoming Hearings', value: upcomingHearings ?? 0, color: 'bg-purple-400', link: '/violations' },
    { label: 'Board Requests', value: boardRequests ?? 0, color: 'bg-emerald-400', link: '/approval-requests' },
    { label: 'Contracts Expiring', value: expiringContracts ?? 0, color: 'bg-orange-400', link: '/vendors' },
  ];

  return (
    <div className="p-6 max-w-[960px] mx-auto space-y-6">
      {/* Header + KPIs */}
      <div>
        <h1 className="text-2xl font-bold text-[#e4e4e7] tracking-[-0.02em]">
          Portier Command Center
        </h1>
        <p className="text-sm text-[#71717a] mt-1 mb-4">
          What needs your attention today.
        </p>
        <div className="grid grid-cols-6 gap-3">
          {kpis.map((kpi, i) => (
            <a
              key={i}
              href={kpi.link}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#0f1012] border border-[#1a1b1e] hover:border-[#27272a] transition-colors"
            >
              <div className={`w-2 h-2 rounded-full ${kpi.color}`} />
              <span className="text-2xl font-bold text-[#e4e4e7] tabular-nums">{kpi.value}</span>
              <span className="text-[11px] text-[#71717a] text-center leading-tight">{kpi.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Health Score */}
      <HealthScoreGauge score={92} />

      {/* Today's Priorities */}
      <TodaysPriorities
        items={[
          { title: 'Violations Awaiting Review', association: 'All associations', count: openViolations ?? 0, dueDate: todayDate, link: '/violations', type: 'violation', priority: 'critical' },
          { title: 'Bills Awaiting Approval', association: 'All associations', count: pendingBills ?? 0, dueDate: todayDate, link: '/bills', type: 'bill', priority: 'high' },
          { title: 'Vendor Contracts Expiring', association: 'Review vendors', count: expiringContracts ?? 0, dueDate: todayDate, link: '/vendors', type: 'contract', priority: 'high' },
          { title: 'Upcoming Hearings', association: 'All associations', count: upcomingHearings ?? 0, dueDate: todayDate, link: '/violations', type: 'hearing', priority: 'normal' },
          { title: 'Open Work Orders', association: 'All associations', count: openWorkOrders ?? 0, dueDate: todayDate, link: '/work-orders', type: 'inspection', priority: 'normal' },
        ]}
      />

      <div className="text-center pt-4">
        <p className="text-[12px] text-[#3f3f46]">
          Press <kbd className="px-1.5 py-0.5 rounded bg-[#18181b] text-[#71717a] font-mono text-[11px]">⌘K</kbd> to search across your portfolio
        </p>
      </div>
    </div>
  );
}
