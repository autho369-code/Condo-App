import { redirect } from 'next/navigation';
import Link from 'next/link';
import React from 'react';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
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

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString();

  const [
    { data: violations },
    { data: workOrders },
    { data: hearings },
    { data: delinquencies },
    { data: boardRequests },
    { data: expiringVendors },
    { data: recentActivity },
    { data: associations },
  ] = await Promise.all([
    db.from('violation_cases').select('id, title, violation_type, status, due_date, associations(name), created_at').not('status', 'in', '("closed","cured","dismissed")').order('created_at', { ascending: false }).limit(15),
    db.from('work_orders').select('id, title, status, priority, due_date, associations(name), vendors(name), created_at').not('status', 'in', '("completed","cancelled")').order('priority', { ascending: true }).order('created_at', { ascending: false }).limit(15),
    db.from('violation_cases').select('id, title, hearing_date, associations(name)').eq('status', 'hearing_pending').order('hearing_date').limit(10),
    db.from('charges').select('id, amount, due_date, owners(full_name), associations(name)').eq('status', 'open').lt('due_date', today).order('due_date').limit(10),
    db.from('approval_requests').select('id, title, status, created_at, associations(name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(10),
    db.from('vendors').select('id, name, insurance_expiry').lte('insurance_expiry', thirtyDays).order('insurance_expiry').limit(10),
    db.from('activity_log').select('id, action, entity_type, entity_id, created_at').order('created_at', { ascending: false }).limit(20),
    db.from('associations').select('id, name').order('name'),
  ]);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      open: 'bg-red-50 text-red-700 border-red-200', notice_sent: 'bg-amber-50 text-amber-700 border-amber-200',
      hearing_pending: 'bg-purple-50 text-purple-700 border-purple-200', fined: 'bg-orange-50 text-orange-700 border-orange-200',
      closed: 'bg-gray-50 text-gray-500 border-gray-200', cured: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dismissed: 'bg-gray-50 text-gray-400 border-gray-200',
      pending: 'bg-amber-50 text-amber-700 border-amber-200', in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
      waiting_on_vendor: 'bg-purple-50 text-purple-700 border-purple-200', cancelled: 'bg-gray-50 text-gray-400 border-gray-200',
    };
    return map[s] || 'bg-gray-50 text-gray-500 border-gray-200';
  };

  const priorityBadge = (p: string) => {
    const map: Record<string, string> = { urgent: 'text-red-600 font-semibold', high: 'text-amber-600 font-semibold', normal: 'text-gray-500', low: 'text-gray-400' };
    return map[p] || 'text-gray-500';
  };

  return (
    <div className="bg-[#f5f6f8] min-h-full">
      <div className="px-6 py-4 space-y-3 max-w-full">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Command Center</h1>
            <p className="text-xs text-gray-500">{today} · {(associations ?? []).length} associations</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Link href="/violations/new" className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">+ Violation</Link>
            <Link href="/work-orders/new" className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">+ Work Order</Link>
            <Link href="/bills/new" className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">+ Bill</Link>
            <Link href="/letters/new" className="px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700">+ Notice</Link>
          </div>
        </div>

        {/* SECTION 1: What is late? — Violations */}
        <QueueSection
          title="Violations Awaiting Review"
          count={(violations ?? []).length}
          href="/violations"
          empty="No open violations"
          columns={['Violation', 'Association', 'Status', 'Due']}
        >
          {(violations ?? []).slice(0, 8).map((v: any) => (
            <Link key={v.id} href="/violations" className="flex items-center gap-4 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm">
              <span className="flex-1 min-w-0 font-medium text-gray-900 truncate">{v.title || v.violation_type?.replace(/_/g, ' ') || 'Violation'}</span>
              <span className="w-36 text-gray-500 text-xs truncate">{v.associations?.name || '—'}</span>
              <span className={`w-24 text-xs px-2 py-0.5 rounded border ${statusBadge(v.status)}`}>{v.status?.replace(/_/g, ' ') || 'open'}</span>
              <span className="w-20 text-right text-xs text-gray-500 tabular-nums">{v.due_date ? date(v.due_date) : '—'}</span>
            </Link>
          ))}
        </QueueSection>

        {/* SECTION 2: What is broken? — Work Orders */}
        <QueueSection
          title="Work Orders Awaiting Assignment"
          count={(workOrders ?? []).length}
          href="/work-orders"
          empty="No open work orders"
          columns={['Work Order', 'Association', 'Vendor', 'Status', 'Priority']}
        >
          {(workOrders ?? []).slice(0, 8).map((wo: any) => (
            <Link key={wo.id} href="/work-orders" className="flex items-center gap-4 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm">
              <span className="flex-1 min-w-0 font-medium text-gray-900 truncate">{wo.title || 'Work Order'}</span>
              <span className="w-32 text-gray-500 text-xs truncate">{wo.associations?.name || '—'}</span>
              <span className="w-28 text-gray-500 text-xs truncate">{wo.vendors?.name || 'Unassigned'}</span>
              <span className={`w-24 text-xs px-2 py-0.5 rounded border ${statusBadge(wo.status)}`}>{wo.status?.replace(/_/g, ' ') || 'open'}</span>
              <span className={`w-16 text-xs ${priorityBadge(wo.priority)}`}>{wo.priority || 'normal'}</span>
            </Link>
          ))}
        </QueueSection>

        {/* SECTION 3: Who owes money? — Delinquencies */}
        <QueueSection
          title="Delinquent Accounts"
          count={(delinquencies ?? []).length}
          href="/charges"
          empty="No delinquent accounts"
          columns={['Owner', 'Association', 'Amount', 'Due Date']}
        >
          {(delinquencies ?? []).slice(0, 6).map((d: any) => (
            <Link key={d.id} href="/charges" className="flex items-center gap-4 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm">
              <span className="flex-1 min-w-0 font-medium text-gray-900 truncate">{d.owners?.full_name || 'Owner'}</span>
              <span className="w-36 text-gray-500 text-xs truncate">{d.associations?.name || '—'}</span>
              <span className="w-24 text-right font-semibold text-red-600 tabular-nums text-xs">{money(d.amount)}</span>
              <span className="w-20 text-right text-xs text-red-500">{date(d.due_date)}</span>
            </Link>
          ))}
        </QueueSection>

        {/* SECTION 4: What expires? — Vendor certs + hearings */}
        <div className="grid grid-cols-2 gap-3">
          <QueueSection
            title="Vendor Certificates Expiring"
            count={(expiringVendors ?? []).length}
            href="/vendors"
            empty="No expiring certificates"
            columns={['Vendor', 'Expires']}
            compact
          >
            {(expiringVendors ?? []).slice(0, 5).map((v: any) => (
              <Link key={v.id} href="/vendors" className="flex items-center gap-4 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm">
                <span className="flex-1 min-w-0 font-medium text-gray-900 truncate">{v.name}</span>
                <span className="text-xs text-red-600 tabular-nums">{date(v.insurance_expiry)}</span>
              </Link>
            ))}
          </QueueSection>

          <QueueSection
            title="Upcoming Hearings"
            count={(hearings ?? []).length}
            href="/violations"
            empty="No upcoming hearings"
            columns={['Case', 'Association', 'Date']}
            compact
          >
            {(hearings ?? []).slice(0, 5).map((h: any) => (
              <Link key={h.id} href="/violations" className="flex items-center gap-4 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm">
                <span className="flex-1 min-w-0 font-medium text-gray-900 truncate">{h.title || 'Hearing'}</span>
                <span className="w-36 text-gray-500 text-xs truncate">{h.associations?.name || '—'}</span>
                <span className="text-xs text-gray-600 tabular-nums">{h.hearing_date ? date(h.hearing_date) : '—'}</span>
              </Link>
            ))}
          </QueueSection>
        </div>

        {/* SECTION 5: What needs approval? — Board requests */}
        <QueueSection
          title="Board Requests Pending Approval"
          count={(boardRequests ?? []).length}
          href="/approval-requests"
          empty="No pending board requests"
          columns={['Request', 'Association', 'Submitted']}
        >
          {(boardRequests ?? []).slice(0, 5).map((r: any) => (
            <Link key={r.id} href="/approval-requests" className="flex items-center gap-4 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm">
              <span className="flex-1 min-w-0 font-medium text-gray-900 truncate">{r.title || 'Request'}</span>
              <span className="w-36 text-gray-500 text-xs truncate">{r.associations?.name || '—'}</span>
              <span className="text-xs text-gray-500 tabular-nums">{date(r.created_at)}</span>
            </Link>
          ))}
        </QueueSection>

        {/* SECTION 6: Activity feed */}
        {recentActivity && recentActivity.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Recent Activity</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {(recentActivity ?? []).slice(0, 10).map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 text-xs text-gray-600">
                  <span className="text-gray-400 tabular-nums w-16 flex-shrink-0">{a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  <span>{a.action} {a.entity_type} {a.entity_id?.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 7: Association Health — below the fold */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Association Health</h3>
          <div className="grid grid-cols-4 gap-3">
            {(associations ?? []).map((a: any) => (
              <Link key={a.id} href={`/dashboard?assoc=${a.id}`} className="flex items-center justify-between px-3 py-2 rounded border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors">
                <span className="text-xs font-medium text-gray-700 truncate">{a.name}</span>
                <span className="text-xs font-semibold text-emerald-600 tabular-nums ml-2">85</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueSection({ title, count, href, empty, columns, children, compact }: {
  title: string; count: number; href: string; empty: string; columns: string[]; children: React.ReactNode; compact?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
          {count > 0 && <span className="text-[11px] font-semibold text-white bg-gray-700 px-1.5 py-0.5 rounded tabular-nums">{count}</span>}
        </div>
        <Link href={href} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium">View all →</Link>
      </div>
      {!compact && (
        <div className="flex items-center gap-4 px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[11px] font-medium text-gray-500 uppercase tracking-wide">
          {columns.map((c, i) => (
            <span key={i} className={i === 0 ? 'flex-1 min-w-0' : i === 1 ? 'w-36' : i === 2 ? 'w-24' : 'w-20 text-right'}>{c}</span>
          ))}
        </div>
      )}
      <div>
        {React.Children.count(children) > 0 ? children : (
          <div className="px-4 py-8 text-center text-xs text-gray-400">{empty}</div>
        )}
      </div>
    </div>
  );
}
