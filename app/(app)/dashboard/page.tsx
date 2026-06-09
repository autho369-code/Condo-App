import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { HealthScoreGauge } from '@/components/command-center/health-score';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CommandCenterPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  if (me.is_full_access_staff && me.portfolio?.id && process.env.LOCAL_PREVIEW_MODE !== 'true') {
    const { count } = await db.from('associations').select('id', { count: 'exact', head: true }).eq('portfolio_id', me.portfolio.id);
    if ((count ?? 0) === 0) redirect('/onboard');
  }

  const todayDate = new Date().toISOString().slice(0, 10);
  const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString();

  const [
    { count: openViolations }, { data: violations },
    { count: openWorkOrders }, { data: workOrders },
    { count: upcomingHearings },
    { count: pendingBoardRequests },
    { count: expiringContracts },
    { data: delinquentOwners },
    { count: pendingBills },
  ] = await Promise.all([
    db.from('violation_cases').select('id', { count: 'exact', head: true }).not('status', 'in', '("closed","cured","dismissed")'),
    db.from('violation_cases').select('id, title, violation_type, status, due_date, associations(name), created_at').not('status', 'in', '("closed","cured","dismissed")').order('created_at', { ascending: false }).limit(10),
    db.from('work_orders').select('id', { count: 'exact', head: true }).not('status', 'in', '("completed","cancelled")'),
    db.from('work_orders').select('id, title, status, priority, due_date, associations(name), vendors(name), created_at').not('status', 'in', '("completed","cancelled")').order('created_at', { ascending: false }).limit(10),
    db.from('violation_cases').select('id', { count: 'exact', head: true }).eq('status', 'hearing_pending'),
    db.from('approval_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('vendors').select('id', { count: 'exact', head: true }).lte('insurance_expiry', thirtyDaysOut),
    db.from('charges').select('id, amount, due_date, owners(full_name), associations(name)').eq('status', 'open').lt('due_date', todayDate).order('due_date').limit(8),
    db.from('payable_bills').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
  ]);

  const metrics = [
    { label: 'Open Violations', value: openViolations ?? 0, href: '/violations', color: '#ef4444' },
    { label: 'Open Work Orders', value: openWorkOrders ?? 0, href: '/work-orders', color: '#3b82f6' },
    { label: 'Pending Bills', value: pendingBills ?? 0, href: '/bills', color: '#f59e0b' },
    { label: 'Upcoming Hearings', value: upcomingHearings ?? 0, href: '/violations', color: '#8b5cf6' },
    { label: 'Board Requests', value: pendingBoardRequests ?? 0, href: '/approval-requests', color: '#10b981' },
    { label: 'Expiring Contracts', value: expiringContracts ?? 0, href: '/vendors', color: '#f97316' },
  ];

  const statusColors: Record<string, string> = {
    open: 'bg-red-100 text-red-700', notice_sent: 'bg-amber-100 text-amber-700',
    hearing_pending: 'bg-purple-100 text-purple-700', fined: 'bg-orange-100 text-orange-700',
    closed: 'bg-gray-100 text-gray-600', cured: 'bg-emerald-100 text-emerald-700',
    dismissed: 'bg-gray-100 text-gray-500',
    pending: 'bg-amber-100 text-amber-700', in_progress: 'bg-blue-100 text-blue-700',
    waiting_on_vendor: 'bg-purple-100 text-purple-700', cancelled: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="bg-[#f8f9fb] min-h-full">
      <div className="px-6 pt-5 pb-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-semibold text-gray-900 tracking-[-0.02em]">Command Center</h1>
            <p className="text-[13px] text-gray-500 mt-0.5">{todayDate}</p>
          </div>
        </div>

        {/* Metric strip */}
        <div className="grid grid-cols-6 gap-3">
          {metrics.map((m, i) => (
            <Link key={i} href={m.href} className="flex flex-col bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all">
              <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{m.label}</span>
              <span className="text-[28px] font-bold text-gray-900 mt-1 tabular-nums leading-none">{m.value}</span>
            </Link>
          ))}
        </div>

        {/* Main content: two columns */}
        <div className="grid grid-cols-3 gap-4">
          {/* Left: Violations */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-[13px] font-semibold text-gray-900">Violations Awaiting Review</h3>
              <Link href="/violations" className="text-[12px] text-blue-600 hover:text-blue-800 font-medium">View all</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(violations ?? []).slice(0, 6).map((v: any) => (
                <Link key={v.id} href={`/violations`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  <span className="flex-1 min-w-0">
                    <span className="text-[13px] text-gray-900 font-medium truncate block">{v.title || v.violation_type?.replace(/_/g, ' ') || 'Violation'}</span>
                    <span className="text-[12px] text-gray-500">{v.associations?.name || '—'} {v.due_date ? `· Due ${date(v.due_date)}` : ''}</span>
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${statusColors[v.status] || 'bg-gray-100 text-gray-600'}`}>{v.status?.replace(/_/g, ' ') || 'open'}</span>
                </Link>
              ))}
              {(!violations || violations.length === 0) && (
                <div className="px-4 py-6 text-center text-[13px] text-gray-400">No open violations</div>
              )}
            </div>
          </div>

          {/* Center: Work Orders */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-[13px] font-semibold text-gray-900">Open Work Orders</h3>
              <Link href="/work-orders" className="text-[12px] text-blue-600 hover:text-blue-800 font-medium">View all</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {(workOrders ?? []).slice(0, 6).map((wo: any) => (
                <Link key={wo.id} href={`/work-orders`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  <span className="flex-1 min-w-0">
                    <span className="text-[13px] text-gray-900 font-medium truncate block">{wo.title || 'Work Order'}</span>
                    <span className="text-[12px] text-gray-500">{wo.associations?.name || '—'}{wo.vendors?.name ? ` · ${wo.vendors.name}` : ''}</span>
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${statusColors[wo.status] || 'bg-gray-100 text-gray-600'}`}>{wo.status?.replace(/_/g, ' ') || 'open'}</span>
                </Link>
              ))}
              {(!workOrders || workOrders.length === 0) && (
                <div className="px-4 py-6 text-center text-[13px] text-gray-400">No open work orders</div>
              )}
            </div>
          </div>

          {/* Right: Delinquency + upcoming */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h3 className="text-[13px] font-semibold text-gray-900">Delinquency Alerts</h3>
                <Link href="/charges" className="text-[12px] text-blue-600 hover:text-blue-800 font-medium">View all</Link>
              </div>
              <div className="divide-y divide-gray-50">
                {(delinquentOwners ?? []).slice(0, 5).map((d: any) => (
                  <Link key={d.id} href="/charges" className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <span className="flex-1 min-w-0">
                      <span className="text-[13px] text-gray-900 font-medium truncate block">{d.owners?.full_name || 'Owner'}</span>
                      <span className="text-[12px] text-gray-500">{d.associations?.name || '—'} · Due {date(d.due_date)}</span>
                    </span>
                    <span className="text-[13px] font-semibold text-red-600 tabular-nums">{money(d.amount)}</span>
                  </Link>
                ))}
                {(!delinquentOwners || delinquentOwners.length === 0) && (
                  <div className="px-4 py-6 text-center text-[13px] text-gray-400">No delinquency alerts</div>
                )}
              </div>
            </div>

            {/* Vendor contracts */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-semibold text-gray-900">Vendor Contracts Expiring</h3>
                <Link href="/vendors" className="text-[12px] text-blue-600 hover:text-blue-800 font-medium">View all</Link>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[28px] font-bold text-gray-900 tabular-nums">{expiringContracts ?? 0}</span>
                <span className="text-[12px] text-gray-500">within 30 days</span>
              </div>
            </div>
          </div>
        </div>

        {/* Association Health Score — below operational items */}
        <HealthScoreGauge score={92} />

        <div className="text-center pt-2 pb-4">
          <p className="text-[12px] text-gray-400">
            Press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono text-[11px] border border-gray-200">⌘K</kbd> to search
          </p>
        </div>
      </div>
    </div>
  );
}
