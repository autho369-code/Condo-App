import Link from 'next/link';
import { ReportingTabs } from '@/components/reports/reporting-tabs';
import { MetricsTabs } from '@/components/reports/metrics-tabs';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Alert, SectionTitle } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { displayTimeZone } from '@/lib/time/display-zone';
import { todayInZone } from '@/lib/time/zoned';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PER_MONTH: Record<string, number> = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 1 / 3, semiannual: 1 / 6, annual: 1 / 12, annually: 1 / 12 };

function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
function firstOfMonth(today: string, offset: number) {
  const [y, m] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 10);
}
const rate = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);
const pctText = (v: number | null) => (v == null ? '—' : `${v.toFixed(v % 1 === 0 ? 0 : 2)}%`);

export default async function PricingMetricsPage({ searchParams }: { searchParams: Promise<{ association?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const today = todayInZone(displayTimeZone());

  const assocRes = await fetchAllRows<any>(() => db.from('associations').select('id, name').is('archived_at', null).order('name').order('id'));
  const associations = assocRes.rows;
  const association = UUID.test(sp.association ?? '') && associations.some((a) => a.id === sp.association) ? sp.association! : '';

  const unitRes = await fetchAllRows<any>(() => {
    const q = db.from('units')
      .select('id, unit_number, sqft, buildings!inner(association_id), occupancies(status, move_out_date, dues_amount, dues_frequency)')
      .is('archived_at', null).order('id');
    return association ? q.eq('buildings.association_id', association) : q;
  });
  const loadError = assocRes.error ?? unitRes.error ?? (unitRes.truncated ? 'There are more units than this page can load.' : null);
  const units = unitRes.rows as any[];

  /** A unit is occupied on `day` when it has a current occupancy that has not ended by then. */
  const occupiedOn = (u: any, day: string) =>
    (u.occupancies ?? []).some((o: any) => o.status === 'current' && (!o.move_out_date || o.move_out_date > day));

  const total = units.length;
  const occupiedNow = units.filter((u) => occupiedOn(u, today)).length;
  const vacantUnits = units.filter((u) => !occupiedOn(u, today));

  const weeks = Array.from({ length: 9 }, (_, i) => addDays(today, 7 * (i + 1)));
  const projected = weeks.map((d) => ({ day: d, occupied: units.filter((u) => occupiedOn(u, d)).length }));
  const months = Array.from({ length: 12 }, (_, i) => firstOfMonth(today, i + 1));
  const exposure = months.map((d) => ({ day: d, vacant: units.filter((u) => !occupiedOn(u, d)).length }));

  // Monthly dues per square foot, by association, from each unit's current occupancy.
  const nameOf = new Map<string, string>(associations.map((a) => [a.id, a.name]));
  const perSqft = new Map<string, { dues: number; sqft: number; units: number }>();
  for (const u of units) {
    const sqft = Number(u.sqft ?? 0);
    const occ = (u.occupancies ?? []).find((o: any) => o.status === 'current' && Number(o.dues_amount ?? 0) > 0);
    const factor = occ ? PER_MONTH[String(occ.dues_frequency ?? 'monthly')] : undefined;
    if (!occ || !(sqft > 0) || !factor) continue;
    const id = u.buildings?.association_id ?? '';
    const cur = perSqft.get(id) ?? { dues: 0, sqft: 0, units: 0 };
    cur.dues += Number(occ.dues_amount) * factor;
    cur.sqft += sqft;
    cur.units += 1;
    perSqft.set(id, cur);
  }
  const sqftRows = [...perSqft.entries()]
    .map(([id, v]) => ({ id, name: nameOf.get(id) ?? 'Association', ...v }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <DataWorkspace
      title="Metrics"
      description="Occupancy today, projected occupancy, the vacancy still ahead, and dues per square foot."
    >
      <ReportingTabs current="metrics" />
      <MetricsTabs current="pricing" />
      <div className="space-y-6">
        {loadError && <Alert tone="danger" title="Some figures could not be loaded">{loadError}</Alert>}
        <FilterBar action="/metrics/pricing" search={false}>
          <FilterSelect label="Association" name="association" defaultValue={association}>
            <option value="">All associations</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
        </FilterBar>

        <MetricStrip metrics={[
          { label: 'Current occupancy', value: pctText(rate(occupiedNow, total)), sublabel: `${occupiedNow.toLocaleString()} of ${total.toLocaleString()} units` },
          { label: 'Units vacant', value: vacantUnits.length.toLocaleString(), sublabel: <Link href="/units" className="underline">View units</Link> },
        ]} />

        <section className="space-y-3">
          <SectionTitle title="Projected occupancy, next 9 weeks" />
          <Table>
            <THead><TR><TH>Week of</TH><TH className="text-right">Occupied</TH><TH className="text-right">Vacant</TH><TH className="text-right">Occupancy</TH></TR></THead>
            <tbody>
              {projected.map((p) => (
                <TR key={p.day}>
                  <TD>{date(p.day)}</TD>
                  <TD className="text-right tabular-nums">{p.occupied.toLocaleString()}</TD>
                  <TD className="text-right tabular-nums">{(total - p.occupied).toLocaleString()}</TD>
                  <TD className="text-right tabular-nums">{pctText(rate(p.occupied, total))}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <p className="text-xs text-gray-500">Based on each current occupancy&apos;s move-out date; units with no move-out date stay occupied.</p>
        </section>

        <section className="space-y-3">
          <SectionTitle title="Projected vacancy exposure, next 12 months" />
          <Table>
            <THead><TR><TH>Month</TH><TH className="text-right">Units vacant on the 1st</TH></TR></THead>
            <tbody>
              {exposure.map((e) => (
                <TR key={e.day}>
                  <TD>{new Date(`${e.day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</TD>
                  <TD className="text-right tabular-nums">{e.vacant.toLocaleString()}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>

        <section className="space-y-3">
          <SectionTitle title="Monthly dues per square foot" />
          {sqftRows.length === 0 ? (
            <p className="text-sm text-gray-500">No occupied units have both a square footage and a dues amount.</p>
          ) : (
            <Table>
              <THead><TR><TH>Association</TH><TH className="text-right">Units</TH><TH className="text-right">Avg monthly dues</TH><TH className="text-right">Per sq ft</TH></TR></THead>
              <tbody>
                {sqftRows.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium text-gray-900">{r.name}</TD>
                    <TD className="text-right tabular-nums">{r.units.toLocaleString()}</TD>
                    <TD className="text-right tabular-nums">{money(r.dues / r.units)}</TD>
                    <TD className="text-right tabular-nums">{money(r.dues / r.sqft)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      </div>
    </DataWorkspace>
  );
}
