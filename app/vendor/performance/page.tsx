import { requireVendor } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, Surface, SectionTitle, MetricStrip, Metric } from '@/components/ui/shell';
import { date } from '@/lib/utils';
import { buildVendorPerformanceScorecard, formatPerformanceDays } from '@/lib/vendors/performance';
import { loadPortfolioVendorPerformanceRows } from '@/lib/vendors/performance-query';

export const dynamic = 'force-dynamic';

export default async function VendorPerformancePage() {
  const me = await requireVendor();
  const supabase = await createClient();
  const db = supabase as any;

  const { data: vendor } = await db
    .from('vendors')
    .select('id, portfolio_id, workers_comp_expiration, general_liability_expiration, auto_insurance_expiration, epa_certification_expiration, state_license_expiration, contract_expiration')
    .eq('id', me.vendor_id)
    .maybeSingle();
  if (!vendor?.portfolio_id) throw new Error('Vendor workspace is missing its management-company scope.');

  const rows = await loadPortfolioVendorPerformanceRows(db, vendor.portfolio_id, [vendor.id]);
  const scorecard = buildVendorPerformanceScorecard(rows, vendor);
  const recentlyCompleted = rows
    .filter((row) => row.completed_date)
    .sort((a, b) => (b.completed_date ?? '').localeCompare(a.completed_date ?? ''))
    .slice(0, 10);

  return (
    <div>
      <PageHeader
        title="Performance"
        description="Your transparent 12-month service record — the same evidence your management company sees."
      />

      <MetricStrip className="mb-6 lg:grid-cols-3">
        <Metric label="Jobs completed" value={scorecard.completed} accent="emerald" />
        <Metric label="Open jobs" value={scorecard.open} sub={`${scorecard.overdue} overdue`} accent={scorecard.overdue > 0 ? 'amber' : 'blue'} />
        <Metric label="Avg completion time" value={formatPerformanceDays(scorecard.averageCompletionDays)} />
        <Metric label="On-time completion" value={scorecard.onTimeRate === null ? '—' : `${scorecard.onTimeRate}%`} sub={scorecard.serviceRecord.evidence} accent={scorecard.onTimeRate !== null && scorecard.onTimeRate >= 85 ? 'emerald' : undefined} />
        <Metric label="Emergency completion" value={formatPerformanceDays(scorecard.emergencyAverageCompletionDays)} sub="Created to completed" />
      </MetricStrip>

      <Surface padded={false}>
        <SectionTitle title="Recently completed" className="px-5 pt-5 sm:px-6" />
        {recentlyCompleted.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 sm:px-6">Completed jobs will build your track record here.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentlyCompleted.map((workOrder) => (
              <li key={workOrder.id} className="flex items-center justify-between gap-4 px-5 py-3 sm:px-6">
                <span className="truncate text-sm text-gray-900">{workOrder.title ?? 'Work order'}</span>
                <span className="shrink-0 text-[13px] tabular-nums text-gray-500">{date(workOrder.completed_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Surface>

      <p className="mt-4 text-xs leading-5 text-gray-400">
        The service label appears after three scheduled completions and is derived only from the visible on-time percentage.
        Metrics use completed work from the trailing 365 days; open and overdue counts are current. Keeping insurance and licenses current on the{' '}
        <a href="/vendor/compliance" className="underline">Compliance</a> page also factors into how management
        companies evaluate vendors.
      </p>
    </div>
  );
}
