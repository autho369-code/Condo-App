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
import { StatusChip } from '@/components/operations/status-chip';
import { Alert } from '@/components/ui/shell';
import { createServiceClient } from '@/lib/supabase/server';
import { addPet, addTenant, addVehicle, endTenancy, removePet, removeVehicle, saveOwnerEmergencyContact, sendOwnerPasswordReset, setOwnerPortalAccess } from './occupancy-actions';
import { addOwnerToBoard, endBoardSeat } from '@/lib/rpcs/board-membership';
import { addOwnerAttachment, removeOwnerAttachment, saveOwnerFinancialDetails } from './financial-actions';

export const dynamic = 'force-dynamic';

function formatName(first?: string | null, last?: string | null, full?: string | null) {
  if (last && first) return `${last}, ${first}`;
  return full ?? [last, first].filter(Boolean).join(', ') ?? '—';
}

export default async function OwnerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ portal_created?: string; email?: string; error?: string; tenant_added?: string; saved?: string }> }) {
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
      .select('id, portfolio_id, full_name, first_name, last_name, email, emails, phone, phone_numbers, address_street, address_city, address_state, address_zip, preferred_comm, notes, portal_activated, portal_login_last_at, created_at, emergency_contact_name, emergency_contact_phone')
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

  // Associations this owner belongs to — the options for a new board seat.
  const boardAssociationOptions = Array.from(
    new Map<string, { id: string; name: string }>(
      currentOccs
        .map((o: any) => o.units?.buildings?.associations)
        .filter((a: any) => a?.id)
        .map((a: any): [string, { id: string; name: string }] => [a.id, { id: a.id, name: a.name ?? 'Association' }]),
    ).values(),
  );

  // ── Tenancy & pets for this owner's current units ──
  const ownedUnitIds = currentOccs.map((o: any) => o.units?.id).filter(Boolean);
  const [{ data: tenants }, { data: pets }] = await Promise.all([
    ownedUnitIds.length > 0
      ? db.from('tenants').select('*').in('unit_id', ownedUnitIds).is('archived_at', null).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    ownedUnitIds.length > 0
      ? db.from('unit_pets').select('*').in('unit_id', ownedUnitIds).is('archived_at', null).order('created_at')
      : Promise.resolve({ data: [] }),
  ]);

  // ── Cross-module records for this owner (board seat, HO-6, vehicles, agreements) ──
  const [
    { data: boardSeats }, { data: ho6Policies }, { data: parkingRows }, { data: mgmtAgreements },
    { data: finDetails }, { data: attachments }, { data: auditRows }, { data: ownerVehicles },
  ] = await Promise.all([
    db.from('board_members')
      .select('id, role, term_start, term_end, active, associations(name)')
      .eq('owner_id', id).eq('active', true),
    db.from('insurance_policies')
      .select('id, policy_number, insurance_company, coverage_amount, expiration_date, status')
      .eq('owner_id', id).is('archived_at', null).order('expiration_date', { ascending: false }).limit(5),
    db.from('parking_assignments')
      .select('id, vehicle_make, vehicle_model, vehicle_color, license_plate, status, parking_spaces(space_number)')
      .eq('owner_id', id).eq('status', 'active'),
    db.from('management_agreements')
      .select('id, name, status, start_date, end_date')
      .eq('owner_id', id).is('archived_at', null).order('start_date', { ascending: false }).limit(5),
    // RLS: only finance staff get a row back — others see the restricted note
    db.from('owner_financial_details').select('*').eq('owner_id', id).maybeSingle(),
    db.from('owner_attachments').select('id, file_name, file_path, content_type, size_bytes, created_at').eq('owner_id', id).order('created_at', { ascending: false }),
    db.from('audit_logs').select('action, actor_email, changes, created_at').eq('entity_type', 'owner').eq('entity_id', id).order('created_at', { ascending: false }).limit(15),
    db.from('owner_vehicles').select('*').eq('owner_id', id).is('archived_at', null).order('created_at'),
  ]);

  // 1-hour signed links for attachments (private bucket)
  const attachmentUrlByPath = new Map<string, string>();
  if ((attachments ?? []).length > 0) {
    const svc2 = createServiceClient() as any;
    const { data: signed } = await svc2.storage.from('association-documents')
      .createSignedUrls((attachments ?? []).map((a: any) => a.file_path), 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) attachmentUrlByPath.set(s.path, s.signedUrl);
    }
  }
  const maskTail = (v: string | null | undefined) => (v ? `••••${v.slice(-4)}` : null);

  const activeTenantsByUnit = new Map<string, any[]>();
  for (const t of (tenants ?? []).filter((t: any) => t.status === 'active')) {
    const list = activeTenantsByUnit.get(t.unit_id) ?? [];
    list.push(t);
    activeTenantsByUnit.set(t.unit_id, list);
  }
  const petsByUnit = new Map<string, any[]>();
  for (const p of pets ?? []) {
    const list = petsByUnit.get(p.unit_id) ?? [];
    list.push(p);
    petsByUnit.set(p.unit_id, list);
  }

  // Signed URLs for lease / insurance documents (1-hour links)
  const docPaths = (tenants ?? []).flatMap((t: any) => [t.lease_document_url, t.insurance_document_url]).filter(Boolean);
  const signedUrlByPath = new Map<string, string>();
  if (docPaths.length > 0) {
    const svc = createServiceClient() as any;
    const { data: signed } = await svc.storage.from('association-documents').createSignedUrls(docPaths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedUrlByPath.set(s.path, s.signedUrl);
    }
  }
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
      {sp.error && <div className="mb-4"><Alert title="Action failed">{sp.error}</Alert></div>}
      {sp.tenant_added === '1' && <div className="mb-4"><Alert tone="success" title="Tenant added" /></div>}
      {sp.saved === 'financial' && <div className="mb-4"><Alert tone="success" title="Financial details saved" /></div>}
      {sp.saved === 'attachment' && <div className="mb-4"><Alert tone="success" title="Attachment added" /></div>}
      {sp.saved === 'reset_sent' && <div className="mb-4"><Alert tone="success" title="Password reset email queued" /></div>}
      {sp.saved === 'portal_enabled' && <div className="mb-4"><Alert tone="success" title="Portal access enabled" /></div>}
      {sp.saved === 'portal_disabled' && <div className="mb-4"><Alert tone="success" title="Portal access disabled">The owner can no longer sign in.</Alert></div>}
      {sp.saved === 'board' && <div className="mb-4"><Alert tone="success" title="Board seat added">Their existing login now opens both the board portal and their owner portal.</Alert></div>}
      {sp.saved === 'board_end' && <div className="mb-4"><Alert tone="success" title="Board seat ended" /></div>}
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
        {/* ── Status badges: standing at a glance ── */}
        <div className="flex flex-wrap items-center gap-2">
          {totalBalance > 0 && pastDueCount > 0 ? (
            <StatusChip tone="danger">Delinquent — {money(totalBalance)} past due</StatusChip>
          ) : totalBalance > 0 ? (
            <StatusChip tone="warning">Balance due — {money(totalBalance)}</StatusChip>
          ) : (
            <StatusChip tone="success">Current</StatusChip>
          )}
          {(boardSeats ?? []).map((s: any) => (
            <StatusChip key={s.id} tone="info">
              Board — {s.role ?? 'Member'}{s.associations?.name ? ` · ${s.associations.name}` : ''}
            </StatusChip>
          ))}
        </div>

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

        {/* ── Board Membership: mark this owner as a board member ── */}
        <Section title="Board Membership">
          <div className="space-y-4 px-5 py-4">
            {(boardSeats ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">
                Not on a board. Add a seat below — the owner&apos;s existing login opens the board portal
                immediately alongside their owner portal (one login, both portals).
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(boardSeats ?? []).map((s: any) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <div className="text-sm">
                      <span className="font-medium capitalize text-gray-900">{(s.role ?? 'director').replace(/_/g, ' ')}</span>
                      <span className="text-gray-500"> — {s.associations?.name ?? 'Association'}</span>
                      {s.term_start && (
                        <span className="ml-2 text-xs text-gray-400">
                          term {date(s.term_start)}{s.term_end ? ` – ${date(s.term_end)}` : ''}
                        </span>
                      )}
                    </div>
                    <form action={endBoardSeat.bind(null, id) as any}>
                      <input type="hidden" name="seat_id" value={s.id} />
                      <button type="submit" className="text-xs font-medium text-red-600 hover:underline">End seat</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            {boardAssociationOptions.length === 0 ? (
              <p className="border-t border-gray-100 pt-3 text-xs text-gray-400">Link this owner to a unit first — board seats attach to their association.</p>
            ) : (
              <form action={addOwnerToBoard.bind(null, id) as any} className="grid grid-cols-1 items-end gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <Label htmlFor="board_association">Association</Label>
                  <select id="board_association" name="association_id" required defaultValue={boardAssociationOptions[0]?.id}
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                    {boardAssociationOptions.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="board_role">Role</Label>
                  <select id="board_role" name="role" required defaultValue="director"
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                    <option value="president">President</option>
                    <option value="vice_president">Vice President</option>
                    <option value="secretary">Secretary</option>
                    <option value="treasurer">Treasurer</option>
                    <option value="director">Director</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="board_term_start">Term start</Label>
                  <Input id="board_term_start" type="date" name="term_start" />
                </div>
                <div>
                  <Label htmlFor="board_term_end">Term end</Label>
                  <Input id="board_term_end" type="date" name="term_end" />
                </div>
                <Button type="submit">Add to board</Button>
              </form>
            )}
          </div>
        </Section>

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
                        <Link href={`/units/${o.units?.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">
                          {o.units?.buildings?.associations?.name ?? 'Association'} — Unit {o.units?.unit_number ?? '—'}
                        </Link>
                        {o.is_primary && <span className="ml-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/15">primary</span>}
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
                      <Link href={`/units/${o.units?.id}`} className="font-medium text-gray-900 hover:text-gray-950 hover:underline">Unit {o.units?.unit_number ?? '—'}</Link>
                      {o.is_primary && <span className="ml-2 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/15">primary</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{o.units?.buildings?.associations?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-sm capitalize">{o.occupancy_type}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">{date(o.move_in_date)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{o.dues_amount ? money(o.dues_amount) : '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${
                        o.status === 'current' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' :
                        o.status === 'future'  ? 'bg-blue-50 text-blue-700 ring-blue-600/15'  :
                        'bg-gray-100 text-gray-500 ring-gray-500/15'
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
            <summary className="cursor-pointer select-none text-sm font-medium text-gray-600 transition-colors hover:text-gray-950 hover:underline">+ Link to a unit</summary>
            <form action={linkOccupancy.bind(null, id) as any} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-3">
                <Label htmlFor="unit_id">Unit <span className="text-red-500">*</span></Label>
                <select id="unit_id" name="unit_id" required
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
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
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
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
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
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

        {/* ── Occupancy, tenants & pets per unit ── */}
        <Section
          title="Occupancy & tenants"
          right={
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler returns a CSV download, not a page
            <a href="/owners/leases/export" className="text-xs font-medium text-gray-600 hover:text-gray-950 hover:underline">Export all leases (CSV)</a>
          }
        >
          {currentOccs.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-gray-500">Link this owner to a unit first to track occupancy.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {currentOccs.map((o: any) => {
                const unitId = o.units?.id;
                const unitTenants = activeTenantsByUnit.get(unitId) ?? [];
                const unitPets = petsByUnit.get(unitId) ?? [];
                const rented = unitTenants.length > 0;
                return (
                  <div key={o.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-950">
                          {o.units?.buildings?.associations?.name ?? 'Association'} — Unit {o.units?.unit_number ?? '—'}
                        </span>
                        <StatusChip tone={rented ? 'info' : 'success'}>
                          {rented ? 'Rented to tenant' : 'Owner-occupied'}
                        </StatusChip>
                      </div>
                    </div>

                    {/* Active tenants */}
                    {unitTenants.map((t: any) => (
                      <div key={t.id} className="mt-3 rounded-xl border border-gray-200/70 bg-gray-50/60 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-950">{t.first_name} {t.last_name}</div>
                            <div className="mt-0.5 text-xs text-gray-500">
                              {t.phone ? <a href={`tel:${t.phone}`} className="text-blue-700 hover:underline">{t.phone}</a> : 'No phone'}
                              {' · '}
                              {t.email ? <a href={`mailto:${t.email}`} className="text-blue-700 hover:underline">{t.email}</a> : 'No email'}
                            </div>
                          </div>
                          <form action={endTenancy.bind(null, t.id, id) as any}>
                            <button type="submit" className="text-xs text-red-600 hover:underline">End tenancy</button>
                          </form>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
                          <div>
                            <dt className="text-xs uppercase tracking-wider text-gray-500">Lease start</dt>
                            <dd className="mt-0.5 tabular-nums">{t.lease_start ? date(t.lease_start) : '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wider text-gray-500">Lease end</dt>
                            <dd className="mt-0.5 tabular-nums">{t.lease_end ? date(t.lease_end) : '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wider text-gray-500">Lease</dt>
                            <dd className="mt-0.5">
                              {t.lease_document_url && signedUrlByPath.get(t.lease_document_url)
                                ? <a href={signedUrlByPath.get(t.lease_document_url)} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">View lease</a>
                                : <span className="text-gray-400">Not uploaded</span>}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs uppercase tracking-wider text-gray-500">Tenant insurance</dt>
                            <dd className="mt-0.5">
                              {t.insurance_document_url && signedUrlByPath.get(t.insurance_document_url)
                                ? <a href={signedUrlByPath.get(t.insurance_document_url)} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">View policy</a>
                                : <span className="text-gray-400">Not uploaded</span>}
                            </dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-xs uppercase tracking-wider text-gray-500">Tenant emergency contact</dt>
                            <dd className="mt-0.5">
                              {t.emergency_contact_name ?? '—'}
                              {t.emergency_contact_phone ? <> · <a href={`tel:${t.emergency_contact_phone}`} className="text-blue-700 hover:underline">{t.emergency_contact_phone}</a></> : null}
                            </dd>
                          </div>
                          {t.notes && (
                            <div className="col-span-2">
                              <dt className="text-xs uppercase tracking-wider text-gray-500">Notes</dt>
                              <dd className="mt-0.5 whitespace-pre-wrap text-gray-700">{t.notes}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    ))}

                    {/* Add tenant */}
                    <details className="mt-3">
                      <summary className="cursor-pointer select-none text-sm font-medium text-gray-600 transition-colors hover:text-gray-950 hover:underline">+ Add tenant for this unit</summary>
                      <form action={addTenant.bind(null, id) as any} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <input type="hidden" name="unit_id" value={unitId} />
                        <div>
                          <Label htmlFor={`t_first_${o.id}`}>First name <span className="text-red-500">*</span></Label>
                          <Input id={`t_first_${o.id}`} name="first_name" required />
                        </div>
                        <div>
                          <Label htmlFor={`t_last_${o.id}`}>Last name <span className="text-red-500">*</span></Label>
                          <Input id={`t_last_${o.id}`} name="last_name" required />
                        </div>
                        <div>
                          <Label htmlFor={`t_phone_${o.id}`}>Phone</Label>
                          <Input id={`t_phone_${o.id}`} name="phone" type="tel" />
                        </div>
                        <div>
                          <Label htmlFor={`t_email_${o.id}`}>Email</Label>
                          <Input id={`t_email_${o.id}`} name="email" type="email" />
                        </div>
                        <div>
                          <Label htmlFor={`t_ls_${o.id}`}>Lease start</Label>
                          <Input id={`t_ls_${o.id}`} name="lease_start" type="date" />
                        </div>
                        <div>
                          <Label htmlFor={`t_le_${o.id}`}>Lease end</Label>
                          <Input id={`t_le_${o.id}`} name="lease_end" type="date" />
                        </div>
                        <div>
                          <Label htmlFor={`t_lf_${o.id}`}>Lease document</Label>
                          <input id={`t_lf_${o.id}`} name="lease_file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50" />
                        </div>
                        <div>
                          <Label htmlFor={`t_if_${o.id}`}>Tenant insurance</Label>
                          <input id={`t_if_${o.id}`} name="insurance_file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50" />
                        </div>
                        <div>
                          <Label htmlFor={`t_ipn_${o.id}`}>Insurance policy #</Label>
                          <Input id={`t_ipn_${o.id}`} name="insurance_policy_number" />
                        </div>
                        <div>
                          <Label htmlFor={`t_iexp_${o.id}`}>Insurance expiration</Label>
                          <Input id={`t_iexp_${o.id}`} name="insurance_expiration" type="date" />
                        </div>
                        <div>
                          <Label htmlFor={`t_ecn_${o.id}`}>Emergency contact name</Label>
                          <Input id={`t_ecn_${o.id}`} name="emergency_contact_name" />
                        </div>
                        <div>
                          <Label htmlFor={`t_ecp_${o.id}`}>Emergency contact phone</Label>
                          <Input id={`t_ecp_${o.id}`} name="emergency_contact_phone" type="tel" />
                        </div>
                        <div className="md:col-span-2">
                          <Label htmlFor={`t_notes_${o.id}`}>Notes</Label>
                          <Input id={`t_notes_${o.id}`} name="notes" />
                        </div>
                        <div className="md:col-span-3 flex justify-end">
                          <Button type="submit">Add tenant</Button>
                        </div>
                      </form>
                    </details>

                    {/* Pets */}
                    <div className="mt-4">
                      <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Pets ({unitPets.length})</div>
                      {unitPets.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {unitPets.map((p: any) => (
                            <li key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                              <span className="text-gray-900">
                                <span className="font-medium">{p.name}</span>
                                <span className="text-gray-500"> — {p.pet_type}{p.breed ? `, ${p.breed}` : ''}{p.tenant_id ? ' (tenant’s)' : ''}</span>
                              </span>
                              <form action={removePet.bind(null, p.id, id) as any}>
                                <button type="submit" className="text-xs text-red-600 hover:underline">Remove</button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}
                      <details className="mt-2">
                        <summary className="cursor-pointer select-none text-sm font-medium text-gray-600 transition-colors hover:text-gray-950 hover:underline">+ Add pet</summary>
                        <form action={addPet.bind(null, id) as any} className="mt-3 flex flex-wrap items-end gap-2">
                          <input type="hidden" name="unit_id" value={unitId} />
                          <div>
                            <Label htmlFor={`p_type_${o.id}`}>Type</Label>
                            <select id={`p_type_${o.id}`} name="pet_type" required className="h-10 w-32 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                              <option value="dog">Dog</option>
                              <option value="cat">Cat</option>
                              <option value="bird">Bird</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div>
                            <Label htmlFor={`p_name_${o.id}`}>Name</Label>
                            <Input id={`p_name_${o.id}`} name="name" required className="w-36" />
                          </div>
                          <div>
                            <Label htmlFor={`p_breed_${o.id}`}>Breed</Label>
                            <Input id={`p_breed_${o.id}`} name="breed" className="w-40" />
                          </div>
                          {unitTenants.length > 0 && (
                            <div>
                              <Label htmlFor={`p_tenant_${o.id}`}>Belongs to</Label>
                              <select id={`p_tenant_${o.id}`} name="tenant_id" className="h-10 w-44 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                                <option value="">Owner</option>
                                {unitTenants.map((t: any) => (
                                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name} (tenant)</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <Button type="submit" variant="secondary">Add pet</Button>
                        </form>
                      </details>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* ── Owner emergency contact ── */}
        <Section title="Owner emergency contact">
          <form action={saveOwnerEmergencyContact.bind(null, id) as any} className="flex flex-wrap items-end gap-3 px-5 py-4">
            <div>
              <Label htmlFor="emergency_contact_name">Contact name</Label>
              <Input id="emergency_contact_name" name="emergency_contact_name" defaultValue={owner.emergency_contact_name ?? ''} className="w-64" />
            </div>
            <div>
              <Label htmlFor="emergency_contact_phone">Contact phone</Label>
              <Input id="emergency_contact_phone" name="emergency_contact_phone" type="tel" defaultValue={owner.emergency_contact_phone ?? ''} className="w-44" />
            </div>
            <Button type="submit" variant="secondary">Save</Button>
          </form>
        </Section>

        {/* ── Contact Edit ── */}
        <div id="contact" className="scroll-mt-20">
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
            <summary className="cursor-pointer select-none text-sm font-medium text-gray-600 transition-colors hover:text-gray-950 hover:underline">Edit contact</summary>
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
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit">Save changes</Button>
              </div>
            </form>
          </details>
        </Section>
        </div>

        {/* ── Federal tax, payout & accounting preferences (finance staff) ── */}
        <Section title="Federal Tax, Payout & Accounting Preferences">
          {finDetails === null && (
            <p className="px-5 py-3 text-xs text-gray-500">
              No details on file yet, or your role does not include finance access. Values below save only for finance-permitted staff.
            </p>
          )}
          <details className="group px-5 py-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-950">
              {finDetails ? 'Edit details' : 'Add details'}
              {finDetails?.hold_payments && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/15">Payments on hold</span>}
              {finDetails?.send_1099 && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/15">1099 enabled</span>}
            </summary>
            <form action={saveOwnerFinancialDetails.bind(null, id, owner.portfolio_id)} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Federal tax</div>
              <div>
                <Label htmlFor="taxpayer_name">Taxpayer name</Label>
                <Input id="taxpayer_name" name="taxpayer_name" defaultValue={finDetails?.taxpayer_name ?? ''} />
              </div>
              <div>
                <Label htmlFor="taxpayer_id">Taxpayer ID (SSN/EIN)</Label>
                <Input id="taxpayer_id" name="taxpayer_id" placeholder={maskTail(finDetails?.taxpayer_id) ?? 'Not on file'} autoComplete="off" />
                <p className="mt-1 text-xs text-gray-500">Leave blank to keep the stored value.</p>
              </div>
              <div>
                <Label htmlFor="tax_form_account_number">Tax form account number</Label>
                <Input id="tax_form_account_number" name="tax_form_account_number" defaultValue={finDetails?.tax_form_account_number ?? ''} />
              </div>
              <div>
                <Label htmlFor="sending_preference_1099">1099 sending preference</Label>
                <select id="sending_preference_1099" name="sending_preference_1099" defaultValue={finDetails?.sending_preference_1099 ?? 'paper'} className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                  <option value="paper">Paper</option>
                  <option value="electronic">Electronic</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="send_1099" defaultChecked={Boolean(finDetails?.send_1099)} className="h-4 w-4 rounded border-gray-300" /> Send 1099?
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="electronic_1099_consent" defaultChecked={Boolean(finDetails?.electronic_1099_consent)} className="h-4 w-4 rounded border-gray-300" /> Consented to electronic 1099
              </label>

              <div className="md:col-span-2 mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Payout bank account (reimbursements &amp; owner payables)</div>
              <div>
                <Label htmlFor="bank_routing_number">Bank routing number</Label>
                <Input id="bank_routing_number" name="bank_routing_number" placeholder={maskTail(finDetails?.bank_routing_number) ?? 'Not on file'} autoComplete="off" />
              </div>
              <div>
                <Label htmlFor="bank_account_number">Bank account number</Label>
                <Input id="bank_account_number" name="bank_account_number" placeholder={maskTail(finDetails?.bank_account_number) ?? 'Not on file'} autoComplete="off" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
                <input type="checkbox" name="paid_by_ach" defaultChecked={Boolean(finDetails?.paid_by_ach)} className="h-4 w-4 rounded border-gray-300" /> Pay this owner by ACH
              </label>

              <div className="md:col-span-2 mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Accounting preferences</div>
              <div>
                <Label htmlFor="check_consolidation">Check consolidation</Label>
                <select id="check_consolidation" name="check_consolidation" defaultValue={finDetails?.check_consolidation ?? 'single_check'} className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                  <option value="single_check">All payables on a single check</option>
                  <option value="separate_checks">Separate check per payable</option>
                </select>
              </div>
              <div>
                <Label htmlFor="default_check_memo">Default check memo</Label>
                <Input id="default_check_memo" name="default_check_memo" defaultValue={finDetails?.default_check_memo ?? ''} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="check_stub_show_detail" defaultChecked={finDetails ? Boolean(finDetails.check_stub_show_detail) : true} className="h-4 w-4 rounded border-gray-300" /> Show detail on check stub
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="hold_payments" defaultChecked={Boolean(finDetails?.hold_payments)} className="h-4 w-4 rounded border-gray-300" /> Hold payments
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="email_echeck_receipt" defaultChecked={Boolean(finDetails?.email_echeck_receipt)} className="h-4 w-4 rounded border-gray-300" /> Email eCheck receipt
              </label>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit">Save financial details</Button>
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

          <Section
            title={`Insurance (HO-6) (${ho6Policies?.length ?? 0})`}
            right={<Link href="/insurance" className="text-xs font-medium text-gray-500 hover:text-gray-900 hover:underline">All policies</Link>}
          >
            {ho6Policies && ho6Policies.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {ho6Policies.map((pol: any) => {
                  const expired = pol.expiration_date && pol.expiration_date < todayStr;
                  return (
                    <li key={pol.id} className="px-4 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{pol.insurance_company ?? 'Policy'}{pol.policy_number ? ` · ${pol.policy_number}` : ''}</span>
                        <StatusChip tone={expired ? 'danger' : 'success'}>{expired ? 'Expired' : 'Active'}</StatusChip>
                      </div>
                      <div className="text-xs text-gray-500">
                        {pol.coverage_amount != null ? `${money(pol.coverage_amount)} coverage · ` : ''}
                        {pol.expiration_date ? `Expires ${date(pol.expiration_date)}` : 'No expiration on file'}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="px-4 py-6 text-center text-sm text-gray-500">No HO-6 policy on file.</p>}
          </Section>

          <Section
            title={`Vehicles (${(ownerVehicles?.length ?? 0) + (parkingRows?.length ?? 0)})`}
            right={<Link href="/parking" className="text-xs font-medium text-gray-500 hover:text-gray-900 hover:underline">Parking</Link>}
          >
            {((ownerVehicles?.length ?? 0) + (parkingRows?.length ?? 0)) > 0 ? (
              <ul className="divide-y divide-gray-100">
                {(ownerVehicles ?? []).map((v: any) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                    <div>
                      <span className="font-medium">
                        {[v.year, v.color, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle on file'}
                      </span>
                      {v.license_plate && <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-700">{v.license_plate}{v.plate_state ? ` (${v.plate_state})` : ''}</span>}
                    </div>
                    <form action={removeVehicle.bind(null, v.id, id)}>
                      <button type="submit" className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-red-600">Remove</button>
                    </form>
                  </li>
                ))}
                {(parkingRows ?? []).map((v: any) => (
                  <li key={v.id} className="px-4 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {[v.vehicle_color, v.vehicle_make, v.vehicle_model].filter(Boolean).join(' ') || 'Vehicle on file'}
                      </span>
                      {v.license_plate && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium tabular-nums text-gray-700">{v.license_plate}</span>}
                    </div>
                    <div className="text-xs text-gray-500">Parking space {v.parking_spaces?.space_number ?? '—'}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-6 text-center text-sm text-gray-500">No vehicles on file.</p>}
            <details className="border-t border-gray-100 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-950">+ Add vehicle</summary>
              <form action={addVehicle.bind(null, id)} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Input name="make" placeholder="Make" />
                <Input name="model" placeholder="Model" />
                <Input name="color" placeholder="Color" />
                <Input name="year" placeholder="Year" inputMode="numeric" />
                <Input name="license_plate" placeholder="Plate" />
                <Input name="plate_state" placeholder="State" />
                <div className="col-span-2 flex justify-end sm:col-span-3">
                  <Button type="submit" size="sm" variant="secondary">Add vehicle</Button>
                </div>
              </form>
            </details>
          </Section>

          <Section
            title={`Management agreements (${mgmtAgreements?.length ?? 0})`}
            right={<Link href={`/owners/management-agreements?owner=${id}`} className="text-xs font-medium text-gray-500 hover:text-gray-900 hover:underline">New agreement</Link>}
          >
            {mgmtAgreements && mgmtAgreements.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {mgmtAgreements.map((ag: any) => (
                  <li key={ag.id} className="px-4 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{ag.name ?? 'Management agreement'}</span>
                      <StatusChip tone={ag.status === 'active' ? 'success' : 'neutral'}>{ag.status ?? '—'}</StatusChip>
                    </div>
                    <div className="text-xs text-gray-500">
                      {ag.start_date ? date(ag.start_date) : '—'} — {ag.end_date ? date(ag.end_date) : 'ongoing'}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-6 text-center text-sm text-gray-500">No management agreements on file.</p>}
          </Section>

          <Section title={`Attachments (${attachments?.length ?? 0})`}>
            <div className="divide-y divide-gray-100">
              {(attachments ?? []).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                  <div className="min-w-0">
                    {attachmentUrlByPath.has(a.file_path) ? (
                      <a href={attachmentUrlByPath.get(a.file_path)} target="_blank" rel="noreferrer" className="block truncate font-medium text-gray-900 hover:underline">{a.file_name}</a>
                    ) : (
                      <span className="block truncate font-medium text-gray-900">{a.file_name}</span>
                    )}
                    <div className="text-xs text-gray-500">
                      {a.size_bytes != null ? `${Math.max(1, Math.round(a.size_bytes / 1024))} KB · ` : ''}{date(a.created_at)}
                    </div>
                  </div>
                  <form action={removeOwnerAttachment.bind(null, id, a.id)}>
                    <button type="submit" className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-red-600">Remove</button>
                  </form>
                </div>
              ))}
              {(attachments ?? []).length === 0 && (
                <p className="px-4 py-4 text-center text-sm text-gray-500">No attachments yet.</p>
              )}
              <form action={addOwnerAttachment.bind(null, id, owner.portfolio_id)} className="flex items-center gap-2 px-4 py-3">
                <input type="file" name="file" required className="block w-full text-xs text-gray-600 file:mr-2 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-50" />
                <Button type="submit" size="sm" variant="secondary">Upload</Button>
              </form>
            </div>
          </Section>

          <Section title="Audit log">
            {auditRows && auditRows.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {auditRows.map((r: any, i: number) => (
                  <li key={i} className="px-4 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium capitalize">{String(r.action).replace(/[:_]/g, ' ')}</span>
                      <span className="text-xs text-gray-400">{date(r.created_at)}</span>
                    </div>
                    <div className="truncate text-xs text-gray-500">
                      {r.actor_email ?? 'system'}
                      {r.changes ? ` · ${Object.keys(r.changes).join(', ')}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-6 text-center text-sm text-gray-500">No recorded changes yet. Edits to this owner are logged automatically from now on.</p>}
          </Section>

          <div id="portal-access" className="scroll-mt-20">
          <Section title="Portal access">
            <div className="space-y-3 px-4 py-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Status:</span>
                <StatusChip tone={owner.portal_activated ? 'success' : 'neutral'}>
                  {owner.portal_activated ? 'Active' : 'Not active'}
                </StatusChip>
                {owner.portal_login_last_at && (
                  <span className="text-xs text-gray-400">Last login {date(owner.portal_login_last_at)}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={sendOwnerPasswordReset.bind(null, id)}>
                  <Button type="submit" size="sm" variant="secondary">Send password reset</Button>
                </form>
                {owner.portal_activated ? (
                  <form action={setOwnerPortalAccess.bind(null, id, false)}>
                    <button type="submit" className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50">Disable portal access</button>
                  </form>
                ) : (
                  <form action={setOwnerPortalAccess.bind(null, id, true)}>
                    <Button type="submit" size="sm" variant="secondary">Enable portal access</Button>
                  </form>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Disabling blocks sign-in immediately (the owner record and history are kept).
                The reset email goes to {owner.email ?? 'the owner’s email on file'}.
              </p>
            </div>
          </Section>
          </div>
        </div>
      </div>
    </DataWorkspace>
    </>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
