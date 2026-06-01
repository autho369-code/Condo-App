import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';

export const dynamic = 'force-dynamic';

export default async function MetricsPage() {
  const me = await requireStaff();
  const supabase = await createClient();

  const { data: summary } = await (supabase as any)
    .from('v_dashboard_summary')
    .select('*')
    .eq('portfolio_id', me.portfolio?.id ?? '00000000-0000-0000-0000-000000000000')
    .maybeSingle();

  const tiles = [
    { label: 'Occupancy', value: summary?.occupancy_pct != null ? `${Number(summary.occupancy_pct).toFixed(1)}%` : '—' },
    { label: 'Open work orders', value: summary?.wo_total ?? 0 },
    { label: 'Work orders completed', value: summary?.wo_completed ?? 0 },
    { label: 'Pending approvals', value: summary?.pending_approvals ?? 0 },
    { label: 'Outstanding bills',   value: summary?.outstanding_bills ?? 0 },
    { label: 'Delinquency 0–30',    value: summary?.delinquency_0_30 ?? 0 },
    { label: 'Delinquency 31–60',   value: summary?.delinquency_31_60 ?? 0 },
    { label: 'Delinquency 61+',     value: summary?.delinquency_61_plus ?? 0 },
    { label: 'Portal not activated', value: summary?.portal_not_activated_count ?? 0 },
    { label: 'Upcoming re-certs',    value: summary?.upcoming_recerts ?? 0 },
    { label: 'Insurance expiring 60d', value: summary?.insurance_expirations_60d ?? 0 },
    { label: 'Open diagnostics',       value: summary?.open_diagnostics ?? 0 },
  ];

  return (
    <ModulePage title="Metrics" description="Portfolio-level operating metrics pulled live from v_dashboard_summary.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t.label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{t.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded border border-gray-200 bg-white px-5 py-4 text-sm">
        <div className="font-medium text-gray-900">Go deeper</div>
        <ul className="mt-2 space-y-1">
          <li><Link href="/dashboard" className="text-brand-600 hover:underline">Full dashboard →</Link></li>
          <li><Link href="/reports/ar_aging" className="text-brand-600 hover:underline">A/R Aging (live) →</Link></li>
          <li><Link href="/diagnostics" className="text-brand-600 hover:underline">Data diagnostics →</Link></li>
        </ul>
      </div>
    </ModulePage>
  );
}
