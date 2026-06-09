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

  // Real metric queries
  const todayDate = new Date().toISOString().slice(0, 10);

  const [{ count: openViolations }, { count: pendingBills }, { count: unreconciled }] = await Promise.all([
    db.from('violation_cases').select('id', { count: 'exact', head: true })
      .not('status', 'in', '("closed","cured","dismissed")'),
    db.from('payable_bills').select('id', { count: 'exact', head: true })
      .eq('status', 'pending_approval'),
    db.from('bank_accounts').select('id', { count: 'exact', head: true })
      .is('last_reconciliation_date', null),
  ]);

  return (
    <div className="p-6 max-w-[960px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e4e4e7] tracking-[-0.02em]">
            Portier Command Center
          </h1>
          <p className="text-sm text-[#71717a] mt-1">
            Everything requiring attention across your portfolio.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0f1012] border border-[#1a1b1e]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[13px] text-[#a1a1aa]">
              {(openViolations ?? 0)} open violations
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0f1012] border border-[#1a1b1e]">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[13px] text-[#a1a1aa]">
              {(pendingBills ?? 0)} bills pending
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0f1012] border border-[#1a1b1e]">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-[13px] text-[#a1a1aa]">
              {(unreconciled ?? 0)} unreconciled
            </span>
          </div>
        </div>
      </div>

      {/* Health Score */}
      <HealthScoreGauge score={92} />

      {/* Today's Priorities */}
      <TodaysPriorities
        items={[
          { title: 'Violations Awaiting Review', association: 'All associations', count: openViolations ?? 0, dueDate: todayDate, link: '/violations', type: 'violation' },
          { title: 'Bills Awaiting Approval', association: 'All associations', count: pendingBills ?? 0, dueDate: todayDate, link: '/bills', type: 'bill' },
          { title: 'Unreconciled Bank Accounts', association: 'All associations', count: unreconciled ?? 0, link: '/bank-accounts', type: 'inspection' },
          { title: 'Elevator Inspection Overdue', association: 'Check inspections', dueDate: '2026-06-01', link: '/inspections', type: 'inspection' },
          { title: 'Vendor Contracts Expiring Soon', association: 'Review vendors', count: 3, dueDate: '2026-06-30', link: '/vendors', type: 'contract' },
        ]}
      />

      {/* Press CMD+K hint */}
      <div className="text-center pt-4">
        <p className="text-[12px] text-[#3f3f46]">
          Press <kbd className="px-1.5 py-0.5 rounded bg-[#18181b] text-[#71717a] font-mono text-[11px]">⌘K</kbd> to search across your portfolio
        </p>
      </div>
    </div>
  );
}
