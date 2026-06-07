import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { money, date } from '@/lib/utils';
import { updateOwner, linkOccupancy, endOccupancy } from '@/lib/rpcs/entities';

export const dynamic = 'force-dynamic';

function formatName(first?: string | null, last?: string | null, full?: string | null) {
  if (last && first) return `${last}, ${first}`;
  return full ?? [last, first].filter(Boolean).join(', ') ?? '—';
}

export default async function OwnerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ portal_created?: string; email?: string }> }) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const now = new Date();
  const currentYear = now.getFullYear();
  const ytdStart = `${currentYear}-01-01`;
  const todayStr = now.toISOString().slice(0, 10);

  const [
    { data: owner },
    { data: occs },
    { data: srs },
    { data: violations },
    { data: units },
  ] = await Promise.all([
    db.from('owners')
      .select('id, full_name, first_name, last_name, email, emails, phone, phone_numbers, address_street, address_city, address_state, address_zip, preferred_comm, notes, portal_activated, portal_login_last_at, created_at')
      .eq('id', id).is('archived_at', null).maybeSingle(),
    db.from('occupancies')
      .select('id, occupancy_type, status, is_primary, share_pct, move_in_date, move_out_date, dues_amount, dues_frequency, online_portal_activated, units(id, unit_number, buildings(name, associations(id, name)))')
      .eq('owner_id', id)
      .order('status').order('move_in_date', { ascending: false }),
    db.from('service_requests')
      .select('id, number, description, priority, status, created_at, units(unit_number)')
      .eq('homeowner_id', id).is('archived_at', null).order('created_at', { ascending: false }).limit(10),
    db.from('violations')
      .select('id, title, status, date_observed, fine_amount, associations(name)')
      .eq('owner_id', id).is('archived_at', null).order('date_observed', { ascending: false }).limit(10),
    db.from('units')
      .select('id, unit_number, buildings(name, associations(name))')
      .is('archived_at', null)
      .order('unit_number'),
  ]);

  if (!owner) notFound();

  const currentOccs = (occs ?? []).filter((o: any) => o.status === 'current');
  const pastOccs    = (occs ?? []).filter((o: any) => o.status === 'past');
  const displayName = formatName(owner.first_name, owner.last_name, owner.full_name);
  const phones: any[] = Array.isArray(owner.phone_numbers) ? owner.phone_numbers : [];

  // Collect unit IDs for financial queries
  const unitIds = (currentOccs ?? []).map((o: any) => o.units?.id).filter(Boolean);
  const allOccUnitIds = (occs ?? []).map((o: any) => o.units?.id).filter(Boolean);

  // ── Financial queries ──
  const financialQueries: Promise<any>[] = [];

  if (unitIds.length > 0) {
    financialQueries.push(
      db.from('unit_balances').select('unit_id, balance, total_charges, total_payments, unit_number').in('unit_id', unitIds)
    );
  } else {
    financialQueries.push(Promise.resolve({ data: [] }));
  }

  const ledgerUnitIds = unitIds.length > 0 ? unitIds : allOccUnitIds;
  if (ledgerUnitIds.length > 0) {
    financialQueries.push(
      db.from('v_homeowner_ledgers').select('*').in('unit_id', ledgerUnitIds)
    );
  } else {
    financialQueries.push(Promise.resolve({ data: [] }));
  }

  if (unitIds.length > 0) {
    financialQueries.push(
      db.from('charges')
        .select('id, amount, description, due_date, charge_type, unit_id, created_at')
        .in('unit_id', unitIds)
        .gte('created_at', ytdStart)
        .order('created_at', { ascending: false })
        .limit(200)
    );
  } else {
    financialQueries.push(Promise.resolve({ data: [] }));
  }

  if (unitIds.length > 0) {
    financialQueries.push(
      db.from('payments')
        .select('id, amount, payment_date, method, reference, notes, unit_id, created_at')
        .in('unit_id', unitIds)
        .gte('created_at', ytdStart)
        .order('created_at', { ascending: false })
        .limit(200)
    );
  } else {
    financialQueries.push(Promise.resolve({ data: [] }));
  }

  const payUnitIds = unitIds.length > 0 ? unitIds : allOccUnitIds;
  if (payUnitIds.length > 0) {
    financialQueries.push(
      db.from('receivable_payments_ledger')
        .select('*')
        .in('unit_id', payUnitIds)
        .order('payment_date', { ascending: false })
        .limit(100)
    );
  } else {
    financialQueries.push(Promise.resolve({ data: [] }));
  }

  const [
    { data: unitBalances },
    { data: ledgers },
    { data: ytdCharges },
    { data: ytdPayments },
    { data: paymentLedger },
  ] = await Promise.all(financialQueries);

  // ── Compute financial summary ──
  const totalBalance = (unitBalances ?? []).reduce((sum: number, b: any) => sum + (b.balance ?? 0), 0);
  const ytdChargeTotal = (ytdCharges ?? []).reduce((sum: number, c: any) => sum + (c.amount ?? 0), 0);
  const ytdPaymentTotal = (ytdPayments ?? []).reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
  const ytdNOI = ytdPaymentTotal - ytdChargeTotal;
  const pastDueCount = (ledgers ?? []).reduce((sum: number, l: any) => sum + (l.open_past_due_count ?? 0), 0);
  const totalOwnershipPct = (currentOccs ?? []).reduce((sum: number, o: any) => sum + (o.share_pct ?? 0), 0);

  const upcomingCharges = (ytdCharges ?? [])
    .filter((c: any) => c.due_date && c.due_date >= todayStr)
    .sort((a: any, b: any) => a.due_date.localeCompare(b.due_date));
  const nextDueDate = upcomingCharges.length > 0 ? upcomingCharges[0].due_date : null;

  const lastPayment = (paymentLedger ?? []).length > 0 ? paymentLedger[0] : null;
  const lastDistributionAmount = lastPayment?.amount ?? null;
  const lastDistributionDate = lastPayment?.payment_date ?? null;

  const financialMetrics = [
    { label: 'Current Balance', value: money(totalBalance), sublabel: totalBalance > 0 ? 'Amount due' : totalBalance < 0 ? 'Credit' : 'Current' },
    { label: `YTD Charges (${currentYear})`, value: money(ytdChargeTotal), sublabel: `${(ytdCharges ?? []).length} charges` },
    { label: `YTD Payments (${currentYear})`, value: money(ytdPaymentTotal), sublabel: `${(ytdPayments ?? []).length} payments` },
    { label: 'Past Due', value: pastDueCount, sublabel: pastDueCount > 0 ? 'Items overdue' : 'None overdue' },
    { label: 'Ownership Share', value: `${totalOwnershipPct.toFixed(1)}%`, sublabel: `${currentOccs.length} unit${currentOccs.length !== 1 ? 's' : ''}` },
    { label: 'Last Distribution', value: lastDistributionAmount != null ? money(lastDistributionAmount) : '—', sublabel: lastDistributionDate ? date(lastDistributionDate) : 'No distributions' },
    { label: 'Next Due Date', value: nextDueDate ? date(nextDueDate) : '—', sublabel: nextDueDate ? 'Upcoming charge' : 'None scheduled' },
    { label: 'YTD Net', value: money(ytdNOI), sublabel: 'Payments minus charges' },
  ];

  // ── Monthly statements ──
  const monthMap = new Map<string, { month: string; charges: number; payments: number; chargeCount: number; paymentCount: number }>();

  const monthKey = (d: string) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };
  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const dt = new Date(parseInt(y), parseInt(m) - 1, 1);
    return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  for (const c of (ytdCharges ?? [])) {
    if (!c.created_at) continue;
    const mk = monthKey(c.created_at);
    const entry = monthMap.get(mk) || { month: mk, charges: 0, payments: 0, chargeCount: 0, paymentCount: 0 };
    entry.charges += c.amount ?? 0;
    entry.chargeCount += 1;
    monthMap.set(mk, entry);
  }
  for (const p of (ytdPayments ?? [])) {
    if (!p.created_at) continue;
    const mk = monthKey(p.created_at);
    const entry = monthMap.get(mk) || { month: mk, charges: 0, payments: 0, chargeCount: 0, paymentCount: 0 };
    entry.payments += p.amount ?? 0;
    entry.paymentCount += 1;
    monthMap.set(mk, entry);
  }

  const monthlyStatements = Array.from(monthMap.values())
    .sort((a, b) => b.month.localeCompare(a.month));

  // ── Distribution history ──
  const distributionHistory = (paymentLedger ?? []).slice(0, 50).map((p: any) => ({
    id: p.payment_id,
    date: p.payment_date,
    amount: p.amount,
    method: p.method,
    unit: p.unit_number,
    association: p.association_name,
    reference: p.reference,
    notes: p.notes,
  }));

  const unitNames = (currentOccs ?? []).map((o: any) => {
    const assocName = o.units?.buildings?.associations?.name ?? '';
    const unitNum = o.units?.unit_number ?? '';
    return assocName ? `${assocName} — Unit ${unitNum}` : `Unit ${unitNum}`;
  }).join(', ');

  return (
    <>
      {sp.portal_created === '1' && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-green-900">Portal account created</h3>
              <p className="text-sm text-green-700 mt-1">
                Owner can now sign in at <strong>/login</strong> with email <strong>{sp.email}</strong>.
                A password was auto-generated. The owner should reset it on first sign-in.
              </p>
            </div>
          </div>
        </div>
      )}
      <DataWorkspace
      title={displayName}
      description={`Owner portal — ${owner.email}${unitNames ? ` · ${unitNames}` : ''}`}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/owners/${id}?view=statements`}>
            <Button variant="secondary" size="sm">View Statements</Button>
          </Link>
          <Link href={`/owners/${id}?view=tax`}>
            <Button variant="secondary" size="sm">Download Tax Docs</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── Financial Summary ── */}
        <MetricStrip metrics={financialMetrics} />

        {/* ── Quick Actions ── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium uppercase tracking-[0.14em] text-gray-400">Quick actions</span>
          <Link href={`/owners/${id}?view=statements`}>
            <Button variant="secondary" size="sm">View statements</Button>
          </Link>
          <Link href={`/owners/${id}?view=tax`}>
            <Button variant="secondary" size="sm">Download tax docs</Button>
          </Link>
          <Link href={`/charges?owner=${id}`}>
            <Button variant="secondary" size="sm">View charges</Button>
          </Link>
        </div>

        {/* ── Owner Profile ── */}
        <Section title="Owner Profile">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Name</dt>
              <dd className="mt-0.5 font-medium">{displayName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Email</dt>
              <dd className="mt-0.5">
                {owner.email ? <a href={`mailto:${owner.email}`} className="text-blue-700 hover:underline">{owner.email}</a> : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Phone</dt>
              <dd className="mt-0.5">
                {phones.length > 0
                  ? phones.map((p: any, i: number) => (
                      <div key={i}>
                        <a href={`tel:${p.number ?? p.value}`} className="text-blue-700 hover:underline">{p.number ?? p.value}</a>
                        {p.type && <span className="ml-1 text-xs text-gray-500">({p.type})</span>}
                      </div>
                    ))
                  : owner.phone ? <a href={`tel:${owner.phone}`} className="text-blue-700 hover:underline">{owner.phone}</a> : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Properties Owned</dt>
              <dd className="mt-0.5">
                {currentOccs.length > 0
                  ? currentOccs.map((o: any) => (
                      <div key={o.id}>
                        <Link href={`/units/${o.units?.id}`} className="text-blue-700 hover:underline">
                          {o.units?.buildings?.associations?.name ?? 'Association'} — Unit {o.units?.unit_number ?? '—'}
                        </Link>
                        {o.is_primary && <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">primary</span>}
                      </div>
                    ))
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Ownership Share</dt>
              <dd className="mt-0.5">
                {currentOccs.length > 0
                  ? currentOccs.map((o: any) => (
                      <div key={o.id} className="tabular-nums">{(o.share_pct ?? 0).toFixed(1)}% — Unit {o.units?.unit_number ?? '—'}</div>
                    ))
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Portal Status</dt>
              <dd className="mt-0.5">
                {owner.portal_activated
                  ? <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">Active</span>
                  : <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Not activated</span>}
                {owner.portal_login_last_at && (
                  <span className="ml-2 text-xs text-gray-500">Last login: {date(owner.portal_login_last_at)}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Mailing Address</dt>
              <dd className="mt-0.5">
                {[owner.address_street, owner.address_city, owner.address_state, owner.address_zip].filter(Boolean).join(', ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Preferred Comm</dt>
              <dd className="mt-0.5 capitalize">{owner.preferred_comm ?? '—'}</dd>
            </div>
          </dl>
        </Section>

        {/* ── Owner Statements ── */}
        <Section
          title="Owner Statements"
          right={<span className="text-xs text-gray-500">{currentYear} YTD</span>}
        >
          {monthlyStatements.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Month</th>
                  <th className="px-4 py-2 text-right font-semibold">Charges</th>
                  <th className="px-4 py-2 text-right font-semibold">Payments</th>
                  <th className="px-4 py-2 text-right font-semibold">Net</th>
                  <th className="px-4 py-2 text-center font-semibold">Items</th>
                </tr>
              </thead>
              <tbody>
                {monthlyStatements.map((ms) => (
                  <tr key={ms.month} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{monthLabel(ms.month)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{money(ms.charges)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{money(ms.payments)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium ${ms.payments - ms.charges >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {money(ms.payments - ms.charges)}
                    </td>
                    <td className="px-4 py-2 text-center text-xs text-gray-500">
                      {ms.chargeCount}c / {ms.paymentCount}p
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 bg-gray-50 text-sm font-semibold">
                <tr>
                  <td className="px-4 py-2">Totals</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(ytdChargeTotal)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(ytdPaymentTotal)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${ytdPaymentTotal - ytdChargeTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {money(ytdPaymentTotal - ytdChargeTotal)}
                  </td>
                  <td className="px-4 py-2 text-center text-xs">{(ytdCharges ?? []).length}c / {(ytdPayments ?? []).length}p</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <p className="px-5 py-6 text-center text-sm text-gray-500">No financial activity in {currentYear}.</p>
          )}
        </Section>

        {/* ── Distribution & Payment History ── */}
        <Section
          title="Distribution & Payment History"
          right={<span className="text-xs text-gray-500">{(distributionHistory ?? []).length} entries</span>}
        >
          {distributionHistory.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Date</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2 text-left font-semibold">Method</th>
                  <th className="px-4 py-2 text-left font-semibold">Unit</th>
                  <th className="px-4 py-2 text-left font-semibold">Association</th>
                  <th className="px-4 py-2 text-left font-semibold">Reference</th>
                </tr>
              </thead>
              <tbody>
                {distributionHistory.map((d: any) => (
                  <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">{date(d.date)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-green-700">{money(d.amount)}</td>
                    <td className="px-4 py-2 capitalize text-gray-600">{d.method ?? '—'}</td>
                    <td className="px-4 py-2">{d.unit ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{d.association ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{d.reference ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-6 text-center text-sm text-gray-500">No payment or distribution history available.</p>
          )}
        </Section>

        {/* ── Units Owned / Occupied ── */}
        <Section title="Units owned / occupied"
          right={<span className="text-xs text-gray-500">{currentOccs.length} current · {pastOccs.length} past</span>}>
          {(occs ?? []).length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-gray-500">Not yet linked to any units. Use the form below.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Unit</th>
                  <th className="px-4 py-2 text-left font-semibold">Association</th>
                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                  <th className="px-4 py-2 text-left font-semibold">Moved in</th>
                  <th className="px-4 py-2 text-right font-semibold">Dues</th>
                  <th className="px-4 py-2 text-left font-semibold">Status</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {(occs ?? []).map((o: any) => (
                  <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link href={`/units/${o.units?.id}`} className="font-medium text-blue-700 hover:underline">Unit {o.units?.unit_number ?? '—'}</Link>
                      {o.is_primary && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">primary</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{o.units?.buildings?.associations?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-sm capitalize">{o.occupancy_type}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{date(o.move_in_date)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{o.dues_amount ? money(o.dues_amount) : '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs capitalize ${
                        o.status === 'current' ? 'bg-green-100 text-green-700' :
                        o.status === 'future'  ? 'bg-blue-100 text-blue-700'  :
                        'bg-gray-100 text-gray-500'
                      }`}>{o.status}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {o.status === 'current' && (
                        <form action={endOccupancy.bind(null, o.id, id) as any}>
                          <button type="submit" className="text-xs text-red-600 hover:underline">End</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <details className="border-t border-gray-100 px-5 py-4" {...((occs ?? []).length === 0 ? { open: true } : {})}>
            <summary className="cursor-pointer select-none text-sm font-medium text-blue-700 hover:underline">+ Link to a unit</summary>
            <form action={linkOccupancy.bind(null, id) as any} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-3">
                <Label htmlFor="unit_id">Unit <span className="text-red-500">*</span></Label>
                <select id="unit_id" name="unit_id" required
                  className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                  <option value="">Choose a unit…</option>
                  {(units ?? []).map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.buildings?.associations?.name} · Unit {u.unit_number}
                      {u.buildings?.name ? ` (${u.buildings.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="occupancy_type">Type</Label>
                <select id="occupancy_type" name="occupancy_type" defaultValue="owner"
                  className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                  <option value="owner">Owner</option>
                  <option value="tenant">Tenant</option>
                </select>
              </div>
              <div>
                <Label htmlFor="move_in_date">Move-in date</Label>
                <Input id="move_in_date" name="move_in_date" type="date" />
              </div>
              <div>
                <Label htmlFor="dues_amount">Monthly dues ($)</Label>
                <Input id="dues_amount" name="dues_amount" type="number" step="0.01" min="0" />
              </div>
              <div>
                <Label htmlFor="dues_frequency">Dues frequency</Label>
                <select id="dues_frequency" name="dues_frequency" defaultValue="monthly"
                  className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div>
                <Label htmlFor="share_pct">Share %</Label>
                <Input id="share_pct" name="share_pct" type="number" step="0.01" min="0" max="100" defaultValue="100" />
              </div>
              <div className="md:col-span-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="is_primary" defaultChecked />
                  Primary occupant
                </label>
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button type="submit">Link to unit</Button>
              </div>
            </form>
          </details>
        </Section>

        {/* ── Contact Edit ── */}
        <Section title="Contact">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Email</dt>
              <dd className="mt-0.5">
                {owner.email ? <a href={`mailto:${owner.email}`} className="text-blue-700 hover:underline">{owner.email}</a> : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Phone</dt>
              <dd className="mt-0.5">
                {phones.length > 0
                  ? phones.map((p: any, i: number) => (
                      <div key={i}>
                        <a href={`tel:${p.number ?? p.value}`} className="text-blue-700 hover:underline">{p.number ?? p.value}</a>
                        {p.type && <span className="ml-1 text-xs text-gray-500">({p.type})</span>}
                      </div>
                    ))
                  : owner.phone ? <a href={`tel:${owner.phone}`} className="text-blue-700 hover:underline">{owner.phone}</a> : '—'}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wider text-gray-500">Mailing address</dt>
              <dd className="mt-0.5">
                {[owner.address_street, owner.address_city, owner.address_state, owner.address_zip].filter(Boolean).join(', ') || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Preferred comm</dt>
              <dd className="mt-0.5 capitalize">{owner.preferred_comm ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-gray-500">Added</dt>
              <dd className="mt-0.5">{date(owner.created_at)}</dd>
            </div>
            {owner.notes && (
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wider text-gray-500">Notes</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{owner.notes}</dd>
              </div>
            )}
          </dl>

          <details className="border-t border-gray-100 px-5 py-4">
            <summary className="cursor-pointer select-none text-sm font-medium text-blue-700 hover:underline">Edit contact</summary>
            <form action={updateOwner.bind(null, id) as any} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="first_name">First name</Label>
                <Input id="first_name" name="first_name" defaultValue={owner.first_name ?? ''} />
              </div>
              <div>
                <Label htmlFor="last_name">Last name</Label>
                <Input id="last_name" name="last_name" defaultValue={owner.last_name ?? ''} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" defaultValue={owner.email ?? ''} />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" name="phone" type="tel" defaultValue={owner.phone ?? ''} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="address_street">Street</Label>
                <Input id="address_street" name="address_street" defaultValue={owner.address_street ?? ''} />
              </div>
              <div>
                <Label htmlFor="address_city">City</Label>
                <Input id="address_city" name="address_city" defaultValue={owner.address_city ?? ''} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="address_state">State</Label>
                  <Input id="address_state" name="address_state" maxLength={2} className="uppercase" defaultValue={owner.address_state ?? ''} />
                </div>
                <div>
                  <Label htmlFor="address_zip">ZIP</Label>
                  <Input id="address_zip" name="address_zip" defaultValue={owner.address_zip ?? ''} />
                </div>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea id="notes" name="notes" rows={3} defaultValue={owner.notes ?? ''}
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit">Save changes</Button>
              </div>
            </form>
          </details>
        </Section>

        {/* ── Recent activity ── */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Section title={`Service requests (${srs?.length ?? 0})`}>
            {srs && srs.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {srs.map((s: any) => (
                  <li key={s.id} className="px-4 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">SR {s.number ?? s.id.slice(0, 8)}</span>
                      <span className={`rounded px-2 py-0.5 text-xs capitalize ${
                        s.status === 'completed' ? 'bg-green-100 text-green-700' :
                        s.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                        'bg-amber-100 text-amber-800'
                      }`}>{s.status}</span>
                    </div>
                    <div className="truncate text-xs text-gray-500">{(s.description ?? '').split('\n')[0]}</div>
                    <div className="text-xs text-gray-400">Unit {s.units?.unit_number} · {date(s.created_at)}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-6 text-center text-sm text-gray-500">No service requests on file.</p>}
          </Section>

          <Section title={`Violations (${violations?.length ?? 0})`}>
            {violations && violations.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {violations.map((v: any) => (
                  <li key={v.id} className="px-4 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{v.title}</span>
                      {v.fine_amount != null && <span className="text-xs tabular-nums text-gray-700">{money(v.fine_amount)}</span>}
                    </div>
                    <div className="text-xs text-gray-500">{v.associations?.name} · {date(v.date_observed)}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-6 text-center text-sm text-gray-500">No violations on file.</p>}
          </Section>
        </div>
      </div>
    </DataWorkspace>
    </>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
