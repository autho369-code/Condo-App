import { ReportingTabs } from '@/components/reports/reporting-tabs';
import { MetricsTabs } from '@/components/reports/metrics-tabs';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Alert, SectionTitle } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { displayTimeZone } from '@/lib/time/display-zone';
import { todayInZone, zonedWallTimeToUtc } from '@/lib/time/zoned';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const MONTH_COUNT = 24;

function monthOptions(zone: string) {
  const [y, m] = todayInZone(zone).split('-').map(Number);
  return Array.from({ length: MONTH_COUNT }, (_, i) => {
    const first = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = first.toISOString().slice(0, 7);
    return { key, label: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }), first };
  });
}

export default async function BusinessMetricsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const zone = displayTimeZone();
  const options = monthOptions(zone);
  const chosen = options.find((o) => o.key === sp.month) ?? options[0];
  const nextFirst = new Date(Date.UTC(chosen.first.getUTCFullYear(), chosen.first.getUTCMonth() + 1, 1));
  const fromDay = chosen.key + '-01';
  const toDay = nextFirst.toISOString().slice(0, 10); // exclusive
  const startOf = (day: string) => (zonedWallTimeToUtc(day, '00:00', zone) ?? new Date(`${day}T00:00:00Z`)).toISOString();

  let loadError: string | null = null;
  const note = (e: unknown) => {
    loadError = loadError ?? (e instanceof Error ? e.message : typeof e === 'string' ? e : String((e as any)?.message ?? e));
    return null;
  };
  const count = async (q: any): Promise<number | null> => {
    const { count: n, error } = await q;
    if (error) return note(error.message);
    return n ?? 0;
  };
  const created = (table: string) => count(db.from(table).select('id', { count: 'exact', head: true }).is('archived_at', null)
    .gte('created_at', startOf(fromDay)).lt('created_at', startOf(toDay)));
  const texts = (direction: string) => count(db.from('sms_messages').select('id', { count: 'exact', head: true }).eq('direction', direction)
    .gte('created_at', startOf(fromDay)).lt('created_at', startOf(toDay)));

  // Staff are counted for the signed-in company only (profiles are read with
  // elevated access, scoped by the session's portfolio).
  const portfolioId = me.portfolio?.id ?? null;
  const staffCount = portfolioId
    ? count((createServiceClient() as any).from('profiles').select('id', { count: 'exact', head: true })
        .eq('portfolio_id', portfolioId).in('hoa_role', ['manager', 'company_admin']).is('disabled_at', null))
    : Promise.resolve(null);

  const [units, staff, workOrders, inspections, sent, received, online, lastAch, lastPacket, lastRecon] = await Promise.all([
    count(db.from('units').select('id', { count: 'exact', head: true }).is('archived_at', null)),
    staffCount,
    created('work_orders'),
    created('inspections'),
    texts('outbound'),
    texts('inbound'),
    fetchAllRows<any>(() => db.from('payments').select('id, amount').or('method.eq.online,processor.not.is.null')
      .gte('payment_date', fromDay).lt('payment_date', toDay).order('id')),
    db.from('payments').select('payment_date').eq('method', 'ach').order('payment_date', { ascending: false }).limit(1).maybeSingle(),
    db.from('owner_packets').select('submitted_at').not('submitted_at', 'is', null).order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('bank_reconciliations').select('statement_date, completed_at').eq('status', 'completed').order('statement_date', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (online.error) note(online.error);
  if (online.truncated) note('There are more online payments than this page can total.');
  for (const r of [lastAch, lastPacket, lastRecon]) if (r.error) note(r.error.message);
  const onlineOk = !online.error && !online.truncated;
  const onlineTotal = online.rows.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
  const n = (v: number | null) => (v == null ? '—' : v.toLocaleString());

  return (
    <DataWorkspace title="Metrics" description="What the company managed and processed in a month, and when key routines last ran.">
      <ReportingTabs current="metrics" />
      <MetricsTabs current="business" />
      <div className="space-y-6">
        {loadError && <Alert tone="danger" title="Some figures could not be loaded">{loadError}</Alert>}
        <FilterBar action="/metrics/business" search={false}>
          <FilterSelect label="Month" name="month" defaultValue={chosen.key}>
            {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </FilterSelect>
        </FilterBar>

        <section className="space-y-3">
          <SectionTitle title="Key metrics" description="Units and staff users as of today." />
          <MetricStrip metrics={[
            { label: 'Units managed', value: n(units) },
            { label: 'Staff users', value: n(staff) },
          ]} />
        </section>
        <section className="space-y-3">
          <SectionTitle title={`Payments, ${chosen.label}`} />
          <MetricStrip metrics={[
            { label: 'Online payments', value: onlineOk ? online.rows.length.toLocaleString() : '—', sublabel: 'Recorded with the online portal method' },
            { label: 'Total received online', value: onlineOk ? money(onlineTotal) : '—' },
          ]} />
        </section>
        <section className="space-y-3">
          <SectionTitle title={`Maintenance, ${chosen.label}`} />
          <MetricStrip metrics={[
            { label: 'Inspections created', value: n(inspections) },
            { label: 'Work orders created', value: n(workOrders) },
          ]} />
        </section>
        <section className="space-y-3">
          <SectionTitle title={`Engagement, ${chosen.label}`} />
          <MetricStrip metrics={[
            { label: 'Texts sent', value: n(sent) },
            { label: 'Texts received', value: n(received) },
          ]} />
        </section>
        <section className="space-y-3">
          <SectionTitle title="Owners and accounting" description="The most recent time each routine ran." />
          <MetricStrip metrics={[
            { label: 'Last ACH payment received', value: lastAch.data?.payment_date ? date(lastAch.data.payment_date) : '—' },
            { label: 'Last owner packet submitted', value: lastPacket.data?.submitted_at ? date(lastPacket.data.submitted_at) : '—' },
            { label: 'Last bank reconciliation', value: lastRecon.data?.statement_date ? date(lastRecon.data.statement_date) : '—' },
          ]} />
        </section>
      </div>
    </DataWorkspace>
  );
}
