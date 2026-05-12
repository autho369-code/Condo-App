import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function MetricsPage() {
  const me = await requireStaff();
  const supabase = await createClient();
  const portfolioId = me.portfolio?.id ?? '00000000-0000-0000-0000-000000000000';

  const [{ data: subscription }, { data: usageRows }, { data: summary }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('tier, status, seats_included, seats_used, associations_limit, units_limit, price_monthly_cents, price_per_seat_cents, currency, current_period_start, current_period_end, trial_ends_at')
      .eq('portfolio_id', portfolioId)
      .maybeSingle(),
    supabase
      .from('usage_metrics')
      .select('period_year, period_month, staff_count, owner_count, association_count, unit_count, work_orders_created, service_requests_created, bills_posted, payments_received, emails_sent, sms_sent, api_calls, storage_bytes, updated_at')
      .eq('portfolio_id', portfolioId)
      .order('period_year', { ascending: true })
      .order('period_month', { ascending: true }),
    supabase
      .from('v_dashboard_summary')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .maybeSingle(),
  ]);

  const rows = usageRows ?? [];
  const latest = rows[rows.length - 1] as any;
  const previous = rows[rows.length - 2] as any;
  const monthlyBase = Number(subscription?.price_monthly_cents ?? 0) / 100;
  const extraSeats = Math.max(0, Number(subscription?.seats_used ?? 0) - Number(subscription?.seats_included ?? 0));
  const seatExpansion = extraSeats * (Number(subscription?.price_per_seat_cents ?? 0) / 100);
  const currentCampaign = subscription?.seats_included
    ? (Number(subscription.seats_used ?? 0) / Number(subscription.seats_included)) * 100
    : 0;
  const projectedVacancyExposure = Math.max(0, Number(subscription?.units_limit ?? 0) - Number(latest?.unit_count ?? 0));
  const demandDelta = latest && previous ? Number(latest.payments_received ?? 0) - Number(previous.payments_received ?? 0) : 0;
  const conversionRate = latest?.owner_count ? (Number(latest.payments_received ?? 0) / Number(latest.owner_count)) * 100 : 0;
  const formatMonth = (row: any) => row ? `${row.period_year}-${String(row.period_month).padStart(2, '0')}` : 'No period';

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-8 py-6">
      <nav className="mb-3 flex gap-4 text-xs font-semibold">
        {[
          ['Reports', '/reports'],
          ['Scheduled Reports', '/scheduled-reports'],
          ['Metrics', '/metrics'],
          ['Surveys', '/surveys'],
          ['Compliance', '/compliance'],
        ].map(([label, href]) => (
          <Link key={href} href={href} className={href === '/metrics' ? 'text-brand-700 underline' : 'text-gray-600 hover:text-brand-700'}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="space-y-4">
        <div>
          <div className="text-xs font-semibold text-brand-700">
            <Link href="/reports/pricing_metrics" className="hover:underline">Pricing Metrics</Link>
            <span className="mx-1 text-gray-400">/</span>
            <Link href="/reports/market_metrics" className="hover:underline">Market Metrics</Link>
            <span className="mx-1 text-gray-400">/</span>
            <Link href="/reports/bank_reconciliation" className="hover:underline">Bank Reconciliation</Link>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Pricing Metrics</h1>
        </div>

        <div className="rounded border border-brand-500 bg-white px-4 py-3 text-center text-sm font-medium text-gray-900">
          Click here to search
        </div>

        <Section title="Demand in the Last 7 Days">
          <div className="grid grid-cols-1 divide-y divide-gray-100 md:grid-cols-3 md:divide-x md:divide-y-0">
            <Metric label="Quote Credits" value={demandDelta} />
            <Metric label="Applications" value={latest?.service_requests_created ?? 0} />
            <Metric label="Conversion Rate" value={`${conversionRate.toFixed(0)}%`} />
          </div>
        </Section>

        <Section title="Occupancy Information">
          <div className="grid grid-cols-1 divide-y divide-gray-100 md:grid-cols-2 md:divide-x md:divide-y-0">
            <Metric label="Occupancy" value={summary?.occupancy_pct != null ? `${Number(summary.occupancy_pct).toFixed(2)}%` : '0%'} />
            <Metric label="Unit Count" value={latest?.unit_count ?? summary?.unit_count ?? 0} />
          </div>
        </Section>

        <Section title="Projected Occupancy Rate">
          <TrendChart rows={rows} metric="unit_count" valueLabel="Units" />
        </Section>

        <Section title="Projected Vacancy Exposure">
          <TrendChart rows={rows} metric="service_requests_created" valueLabel="Requests" />
        </Section>

        <Section title="Price per Square Foot">
          <div className="h-44 border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
            {money(monthlyBase + seatExpansion)} estimated monthly billing for {formatMonth(latest)}.
          </div>
        </Section>

        <Section title="Subscription Summary">
          <div className="grid grid-cols-1 divide-y divide-gray-100 md:grid-cols-3 md:divide-x md:divide-y-0">
            <Metric label="Current Campaign" value={`${currentCampaign.toFixed(2)}%`} />
            <Metric label="Vacancy Exposure" value={projectedVacancyExposure} />
            <Metric label="Period End" value={date(subscription?.current_period_end)} />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-900">{title}</div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-l-4 border-teal-600 px-5 py-4">
      <div className="text-2xl font-semibold tabular-nums text-teal-700">{value}</div>
      <div className="mt-1 text-xs font-medium text-gray-700">{label}</div>
    </div>
  );
}

function TrendChart({ rows, metric, valueLabel }: { rows: any[]; metric: string; valueLabel: string }) {
  const values = rows.map((row) => Number(row[metric] ?? 0));
  const max = Math.max(1, ...values);
  const points = rows.length
    ? rows.map((row, index) => {
        const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
        const y = 90 - (Number(row[metric] ?? 0) / max) * 70;
        return `${x},${y}`;
      }).join(' ')
    : '';

  return (
    <div className="px-5 py-4">
      <svg viewBox="0 0 100 100" className="h-44 w-full overflow-visible">
        {[20, 40, 60, 80].map((line) => (
          <line key={line} x1="0" x2="100" y1={line} y2={line} stroke="#e5e7eb" strokeWidth="0.4" />
        ))}
        {points && <polyline points={points} fill="none" stroke="#0e7490" strokeWidth="1" />}
        {rows.map((row, index) => {
          const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
          const y = 90 - (Number(row[metric] ?? 0) / max) * 70;
          return <circle key={`${row.period_year}-${row.period_month}`} cx={x} cy={y} r="1.1" fill="#0e7490" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-gray-500">
        <span>{rows[0] ? `${rows[0].period_month}/${rows[0].period_year}` : 'No data'}</span>
        <span>{valueLabel}</span>
        <span>{rows[rows.length - 1] ? `${rows[rows.length - 1].period_month}/${rows[rows.length - 1].period_year}` : 'No data'}</span>
      </div>
    </div>
  );
}
