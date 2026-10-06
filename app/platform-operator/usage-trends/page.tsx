import { BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { Alert, EmptyState, PageHeader, SectionTitle, Surface } from '@/components/ui/shell';
import { MetricStrip } from '@/components/operations/metric-strip';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { DataTable, type Column } from '@/components/ui/table';
import {
  USAGE_FIELDS,
  changeLabel,
  monthKey,
  monthLabel,
  previousMonth,
  totalsByMonth,
  type MonthTotals,
  type UsageRow,
} from '@/lib/platform/usage-trends';

export const dynamic = 'force-dynamic';

const count = (n: number | null | undefined) => Number(n ?? 0).toLocaleString('en-US');

type CompanyRow = UsageRow & { company: string };

export default async function UsageTrendsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requirePlatformOperator();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const sinceYear = new Date().getUTCFullYear() - 1;

  const [usageRes, portfoliosRes] = await Promise.all([
    fetchAllRows<UsageRow>(() => db.from('usage_metrics')
      .select('portfolio_id, period_year, period_month, staff_count, owner_count, association_count, unit_count, work_orders_created, service_requests_created, bills_posted, payments_received, emails_sent, sms_sent')
      .gte('period_year', sinceYear)
      .order('period_year', { ascending: false }).order('period_month', { ascending: false }).order('portfolio_id')),
    db.from('portfolios').select('id, company_name'),
  ]);
  const loadError = usageRes.error ?? portfoliosRes.error?.message ?? null;

  const rows = usageRes.rows;
  const months = totalsByMonth(rows).slice(0, 12);
  const selected = months.find((m) => m.month === sp.month) ?? months[0];
  const prior = selected ? months.find((m) => m.month === previousMonth(selected.month)) : undefined;
  const priorLabel = selected ? monthLabel(previousMonth(selected.month), false) : '';

  const names = new Map<string, string>(((portfoliosRes.data ?? []) as any[]).map((p) => [p.id, p.company_name ?? 'Company']));
  const companyRows: CompanyRow[] = selected
    ? rows
      .filter((r) => monthKey(r) === selected.month)
      .map((r) => ({ ...r, company: names.get(r.portfolio_id) ?? 'Company' }))
      .sort((a, b) => Number(b.unit_count ?? 0) - Number(a.unit_count ?? 0) || a.company.localeCompare(b.company))
    : [];

  const strip = (key: keyof MonthTotals & string, label: string) => ({
    label,
    value: count(selected?.[key] as number),
    sublabel: selected ? changeLabel(Number(selected[key]), prior ? Number(prior[key]) : null, priorLabel) : undefined,
  });

  const monthColumns: Column<MonthTotals>[] = [
    { key: 'month', header: 'Month', render: (m) => <span className="font-medium text-gray-900">{monthLabel(m.month)}</span> },
    { key: 'companies', header: 'Companies', align: 'right', render: (m) => count(m.companies) },
    ...USAGE_FIELDS.map((f) => ({ key: f.key, header: f.label, align: 'right' as const, render: (m: MonthTotals) => count(m[f.key]) })),
  ];

  const companyColumns: Column<CompanyRow>[] = [
    { key: 'company', header: 'Company', render: (r) => <span className="font-medium text-gray-900">{r.company}</span> },
    ...USAGE_FIELDS.map((f) => ({ key: f.key, header: f.label, align: 'right' as const, render: (r: CompanyRow) => count(r[f.key]) })),
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Platform analytics"
        title="Usage Trends"
        description="How every company uses the platform, month by month: doors and users on file, plus work orders, service requests, bills, payments and messages created. Counts refresh nightly; months are calendar months in UTC."
      />

      {loadError && <Alert tone="danger" className="mb-5" title="Some usage data could not be loaded:">{loadError}</Alert>}

      {months.length === 0 ? (
        <Surface padded={false}>
          <EmptyState icon={BarChart3} title="No usage recorded yet" description="The nightly usage job fills this in for every company. Check back tomorrow." />
        </Surface>
      ) : (
        <div className="space-y-5">
          <FilterBar action="/platform-operator/usage-trends" search={false}>
            <FilterSelect label="Month" name="month" defaultValue={selected?.month}>
              {months.map((m) => <option key={m.month} value={m.month}>{monthLabel(m.month)}</option>)}
            </FilterSelect>
          </FilterBar>

          <MetricStrip metrics={[
            strip('unit_count', 'Doors'),
            strip('staff_count', 'Staff users'),
            strip('work_orders_created', 'Work orders'),
            strip('service_requests_created', 'Service requests'),
            strip('payments_received', 'Payments'),
            strip('emails_sent', 'Emails'),
          ]} />

          <Surface>
            <SectionTitle title="Month by month" description="Platform totals across every company, newest month first." />
            <DataTable columns={monthColumns} rows={months} rowKey={(m) => m.month} />
          </Surface>

          <Surface>
            <SectionTitle title={`By company · ${selected ? monthLabel(selected.month) : ''}`} description="Largest companies (by doors) first. Open a company for its full profile." />
            <DataTable
              columns={companyColumns}
              rows={companyRows}
              rowKey={(r) => r.portfolio_id}
              onRowHref={(r) => `/platform-operator/companies/${r.portfolio_id}`}
              empty={<EmptyState title="No companies reported this month" />}
            />
          </Surface>
        </div>
      )}
    </div>
  );
}
