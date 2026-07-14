import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section, Tile } from '@/components/workspace/shell';
import { Alert } from '@/components/ui/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { resolveAssociation } from '@/lib/associations/resolve';
import { updateAssociation } from '@/lib/rpcs/entities';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/input';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AssociationProfileTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireStaff();
  const { id: assocParam } = await params;
  const association = await resolveAssociation(assocParam);
  if (!association) notFound();
  const id = association.id;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations')
    .select(`
      id, name, address, address_line_2, city, state, zip,
      portfolio_id, status, archived_at, created_at,
      remit_payee, remit_address, payment_instructions,
      late_fee_enabled, late_fee_amount, late_fee_is_percent, late_fee_grace_days,
      site_manager, site_manager_user_id,
      portfolio:portfolios ( id, company_name )
    `)
    .eq('id', id)
    .maybeSingle();
  if (aErr || !assoc) notFound();

  // Manager-entered payment remittance details (white-glove: each manager sets
  // their own payee / mailing address / bill-pay notes per association).
  async function savePaymentInstructions(formData: FormData) {
    'use server';
    await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/associations/${assocParam}/profile?error=${encodeURIComponent(msg)}`);
    const { error } = await (sb as any)
      .from('associations')
      .update({
        remit_payee: ((formData.get('remit_payee') as string) || '').trim() || null,
        remit_address: ((formData.get('remit_address') as string) || '').trim() || null,
        payment_instructions: ((formData.get('payment_instructions') as string) || '').trim() || null,
      })
      .eq('id', id);
    if (error) fail(error.message);
    revalidatePath(`/associations/${assocParam}/profile`);
    redirect(`/associations/${assocParam}/profile?saved=1`);
  }

  // Automatic late-fee policy — persisted through the shared updateAssociation
  // action (lib/rpcs/entities.ts), which whitelists the late_fee_* fields and
  // re-checks authorization inside the action body.
  async function saveLateFees(formData: FormData) {
    'use server';
    await updateAssociation(id, formData);
    redirect(`/associations/${assocParam}/profile?saved=1`);
  }

  // Managers in this portfolio, for the site-manager assignment dropdown
  const { data: managerProfiles } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, email')
    .eq('portfolio_id', assoc.portfolio_id)
    .eq('hoa_role', 'manager')
    .order('full_name');

  // The assigned site manager receives owner-portal messages for this
  // association (fallback: company admins, then the portfolio support email).
  async function saveSiteManager(formData: FormData) {
    'use server';
    await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/associations/${assocParam}/profile?error=${encodeURIComponent(msg)}`);
    const userId = ((formData.get('site_manager_user_id') as string) || '').trim() || null;
    let displayName: string | null = null;
    if (userId) {
      const { data: mgr } = await (sb as any).from('profiles').select('full_name, email').eq('id', userId).maybeSingle();
      if (!mgr) fail('Selected manager was not found.');
      displayName = mgr.full_name ?? mgr.email ?? null;
    }
    const { error } = await (sb as any)
      .from('associations')
      .update({ site_manager_user_id: userId, site_manager: displayName })
      .eq('id', id);
    if (error) fail(error.message);
    revalidatePath(`/associations/${assocParam}/profile`);
    redirect(`/associations/${assocParam}/profile?saved=1`);
  }

  // Reserve fund settings + loans (audit 2.5) + management fee policy (audit 2.6)
  const [{ data: reserve }, { data: loans }, { data: feePolicies }] = await Promise.all([
    (supabase as any).from('reserve_fund_settings').select('*').eq('association_id', id).maybeSingle(),
    (supabase as any).from('association_loans').select('*').eq('association_id', id).is('archived_at', null).order('created_at'),
    (supabase as any).from('management_fee_policies').select('*').eq('association_id', id).order('effective_from', { ascending: false }).limit(5),
  ]);
  const currentFee = (feePolicies ?? []).find((p: any) => !p.effective_to) ?? (feePolicies ?? [])[0] ?? null;

  async function saveManagementFee(formData: FormData) {
    'use server';
    const me2 = await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/associations/${assocParam}/profile?error=${encodeURIComponent(msg)}`);
    const amountRaw = ((formData.get('fee_amount') as string) || '').replace(/[$,%\s]/g, '');
    if (!amountRaw) fail('Enter a fee amount.');
    const today = new Date().toISOString().slice(0, 10);
    // End the current open policy, then start the new one (history preserved)
    await (sb as any).from('management_fee_policies').update({ effective_to: today }).eq('association_id', id).is('effective_to', null);
    const { error } = await (sb as any).from('management_fee_policies').insert({
      association_id: id,
      fee_type: ((formData.get('fee_type') as string) || 'per_door'),
      amount: Number(amountRaw),
      effective_from: ((formData.get('effective_from') as string) || '').trim() || today,
      notes: ((formData.get('fee_notes') as string) || '').trim() || null,
      created_by: (me2 as any).auth_user_id,
    });
    if (error) fail(error.message);
    revalidatePath(`/associations/${assocParam}/profile`);
    redirect(`/associations/${assocParam}/profile?saved=1`);
  }

  async function saveReserveSettings(formData: FormData) {
    'use server';
    const me2 = await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/associations/${assocParam}/profile?error=${encodeURIComponent(msg)}`);
    const num = (k: string) => { const v = ((formData.get(k) as string) || '').replace(/[$,%\s]/g, ''); return v ? Number(v) : null; };
    const dt = (k: string) => ((formData.get(k) as string) || '').trim() || null;
    const { error } = await (sb as any).from('reserve_fund_settings').upsert({
      association_id: id,
      portfolio_id: assoc.portfolio_id,
      target_amount: num('target_amount'),
      monthly_contribution: num('monthly_contribution'),
      percent_funded: num('percent_funded'),
      last_study_date: dt('last_study_date'),
      next_study_due: dt('next_study_due'),
      notes: ((formData.get('reserve_notes') as string) || '').trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: (me2 as any).auth_user_id,
    }, { onConflict: 'association_id' });
    if (error) fail(error.message);
    revalidatePath(`/associations/${assocParam}/profile`);
    redirect(`/associations/${assocParam}/profile?saved=1`);
  }

  async function addLoan(formData: FormData) {
    'use server';
    await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/associations/${assocParam}/profile?error=${encodeURIComponent(msg)}`);
    const lender = ((formData.get('lender') as string) || '').trim();
    if (!lender) fail('Lender name is required.');
    const num = (k: string) => { const v = ((formData.get(k) as string) || '').replace(/[$,%\s]/g, ''); return v ? Number(v) : null; };
    const dt = (k: string) => ((formData.get(k) as string) || '').trim() || null;
    const { error } = await (sb as any).from('association_loans').insert({
      portfolio_id: assoc.portfolio_id,
      association_id: id,
      lender,
      loan_type: ((formData.get('loan_type') as string) || 'mortgage'),
      original_principal: num('original_principal'),
      current_balance: num('current_balance'),
      interest_rate: num('interest_rate'),
      term_months: num('term_months'),
      start_date: dt('start_date'),
      maturity_date: dt('maturity_date'),
      payment_amount: num('payment_amount'),
      next_payment_date: dt('next_payment_date'),
    });
    if (error) fail(error.message);
    revalidatePath(`/associations/${assocParam}/profile`);
    redirect(`/associations/${assocParam}/profile?saved=1`);
  }

  async function archiveLoan(loanId: string) {
    'use server';
    await requireStaff();
    const sb = await createClient();
    const fail = (msg: string) => redirect(`/associations/${assocParam}/profile?error=${encodeURIComponent(msg)}`);
    const { error } = await (sb as any).from('association_loans').update({ archived_at: new Date().toISOString() }).eq('id', loanId);
    if (error) fail(error.message);
    revalidatePath(`/associations/${assocParam}/profile`);
    redirect(`/associations/${assocParam}/profile?saved=1`);
  }

  // Roll-up counts in parallel
  const buildingsRes = await (supabase as any).from('buildings').select('id').eq('association_id', id);
  const buildingIds = (buildingsRes.data ?? []).map((b: any) => b.id);

  const [unitsRes, boardRes, committeesRes, amenitiesRes, approvalsRes] = await Promise.all([
    buildingIds.length
      ? (supabase as any).from('units').select('id', { count: 'exact', head: true }).in('building_id', buildingIds).is('archived_at', null)
      : Promise.resolve({ count: 0 }),
    (supabase as any).from('board_members').select('id', { count: 'exact', head: true }).eq('association_id', id).eq('active', true),
    (supabase as any).from('committees').select('id', { count: 'exact', head: true }).eq('association_id', id).is('archived_at', null),
    (supabase as any).from('association_amenities').select('id', { count: 'exact', head: true }).eq('association_id', id).is('archived_at', null),
    (supabase as any).from('approval_requests').select('id', { count: 'exact', head: true }).eq('association_id', id).eq('status', 'pending'),
  ]);

  const rail = null;

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="profile" />
          <WorkspaceHeader title={assoc.name} />
        </>
      }
      rail={rail}
    >
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Units"             value={unitsRes.count ?? 0}      href={`/associations/${id}/units`} />
        <Tile label="Board Members"     value={boardRes.count ?? 0}      href={`/associations/${id}/board`} />
        <Tile label="Committees"        value={committeesRes.count ?? 0} href={`/associations/${id}/committees`} />
        <Tile label="Amenities"         value={amenitiesRes.count ?? 0}  href={`/associations/${id}/amenities`} />
        <Tile label="Pending Approvals" value={approvalsRes.count ?? 0}  href={`/associations/${id}/approvals`} tone={(approvalsRes.count ?? 0) > 0 ? 'warning' : 'neutral'} />
      </div>

      <Section title="Association Information" padded>
        <dl className="grid grid-cols-[180px_1fr] gap-y-2.5 text-sm">
          <dt className="text-gray-500">Name</dt>
          <dd className="text-gray-900">{assoc.name}</dd>

          <dt className="text-gray-500">Address</dt>
          <dd className="text-gray-900">
            {assoc.address || <span className="text-gray-400">—</span>}
            {assoc.address_line_2 ? `, ${assoc.address_line_2}` : ''}
            {(assoc.city || assoc.state || assoc.zip) && (
              <div>{[assoc.city, assoc.state].filter(Boolean).join(', ')} {assoc.zip ?? ''}</div>
            )}
          </dd>

          <dt className="text-gray-500">Portfolio</dt>
          <dd className="text-gray-900">{(assoc.portfolio as any)?.company_name ?? <span className="text-gray-400">—</span>}</dd>

          <dt className="text-gray-500">Status</dt>
          <dd className="capitalize text-gray-900">{assoc.status ?? 'active'}</dd>

          <dt className="text-gray-500">Created</dt>
          <dd className="text-gray-900">{assoc.created_at ? formatDate(assoc.created_at) : <span className="text-gray-400">—</span>}</dd>
        </dl>
      </Section>

      <div className="mt-6">
        <Section title="Site Manager" padded>
          <p className="mb-4 text-sm leading-6 text-gray-500">
            The assigned manager receives messages owners send from the owner portal
            (as regular email, reply-to the owner). If no manager is assigned, messages
            fall back to your company admins.
          </p>
          <form action={saveSiteManager} className="flex max-w-2xl items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="site_manager_user_id">Assigned manager</Label>
              <select
                id="site_manager_user_id"
                name="site_manager_user_id"
                defaultValue={assoc.site_manager_user_id ?? ''}
                className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="">— Not assigned (messages go to company admins) —</option>
                {(managerProfiles ?? []).map((m: any) => (
                  <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>
                ))}
              </select>
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Section>
      </div>

      <div className="mt-6">
        <Section title="Payment Instructions" padded>
          <p className="mb-4 text-sm leading-6 text-gray-500">
            Owners pay by check or bank bill-pay. What you enter here is exactly what owners see on their
            <span className="font-medium text-gray-700"> How to Pay</span> page in the owner portal.
          </p>
          {sp.saved && <div className="mb-4"><Alert tone="success" title="Saved">Payment instructions updated.</Alert></div>}
          {sp.error && <div className="mb-4"><Alert tone="danger" title="Could not save">{sp.error}</Alert></div>}
          <form action={savePaymentInstructions} className="max-w-2xl space-y-4">
            <div>
              <Label htmlFor="remit_payee">Make checks payable to</Label>
              <Input id="remit_payee" name="remit_payee" defaultValue={assoc.remit_payee ?? ''} placeholder={`e.g. ${assoc.name}`} />
            </div>
            <div>
              <Label htmlFor="remit_address">Mail payments to</Label>
              <Textarea id="remit_address" name="remit_address" rows={3} defaultValue={assoc.remit_address ?? ''} placeholder={"Street / PO Box or lockbox\nCity, State ZIP"} />
            </div>
            <div>
              <Label htmlFor="payment_instructions">Other options &amp; notes</Label>
              <Textarea id="payment_instructions" name="payment_instructions" rows={4} defaultValue={assoc.payment_instructions ?? ''} placeholder={"Bank bill-pay payee + address, the account/reference owners should use, lockbox details, or any other payment instructions."} />
              <p className="mt-1 text-xs text-gray-500">Tip: tell owners to include their unit number as the account/memo so payments are applied correctly.</p>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Save payment instructions</Button>
            </div>
          </form>
        </Section>
      </div>

      <div className="mt-6">
        <Section title="Late Fees" padded>
          <p className="mb-4 text-sm leading-6 text-gray-500">
            When enabled, a nightly job automatically posts a late fee on each overdue
            assessment once it is past the due date plus the grace period. Each overdue
            charge is assessed at most once.
          </p>
          <form action={saveLateFees} className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <Label htmlFor="late_fee_enabled">Automatic late fees</Label>
              <select
                id="late_fee_enabled"
                name="late_fee_enabled"
                defaultValue={assoc.late_fee_enabled ? 'true' : 'false'}
                className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="false">Disabled</option>
                <option value="true">Enabled</option>
              </select>
            </div>
            <div>
              <Label htmlFor="late_fee_is_percent">Fee type</Label>
              <select
                id="late_fee_is_percent"
                name="late_fee_is_percent"
                defaultValue={assoc.late_fee_is_percent ? 'true' : 'false'}
                className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              >
                <option value="false">Flat amount ($)</option>
                <option value="true">% of unpaid balance</option>
              </select>
            </div>
            <div>
              <Label htmlFor="late_fee_amount">Amount</Label>
              <Input id="late_fee_amount" name="late_fee_amount" inputMode="decimal" defaultValue={assoc.late_fee_amount ?? ''} placeholder="e.g. 25" />
            </div>
            <div>
              <Label htmlFor="late_fee_grace_days">Grace period (days)</Label>
              <Input id="late_fee_grace_days" name="late_fee_grace_days" inputMode="numeric" defaultValue={assoc.late_fee_grace_days ?? 10} />
            </div>
            <div className="flex justify-end sm:col-span-4">
              <Button type="submit">Save late-fee policy</Button>
            </div>
          </form>
        </Section>
      </div>

      <div className="mt-6">
        <Section title="Management Fee" padded>
          <p className="mb-4 text-sm leading-6 text-gray-500">
            What the management company charges this association. Saving a new rate closes the
            current one and keeps the history — the Management Fee Summary report reads from here.
          </p>
          {currentFee && (
            <p className="mb-4 text-sm text-gray-900">
              Current: <span className="font-semibold">
                {currentFee.fee_type === 'percentage' ? `${currentFee.amount}% of assessments`
                  : currentFee.fee_type === 'flat_monthly' ? `$${Number(currentFee.amount).toLocaleString()}/month flat`
                  : `$${Number(currentFee.amount).toLocaleString()}/door/month`}
              </span>
              <span className="ml-2 text-xs text-gray-500">since {currentFee.effective_from}</span>
            </p>
          )}
          <form action={saveManagementFee} className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <Label htmlFor="fee_type">Fee type</Label>
              <select id="fee_type" name="fee_type" defaultValue={currentFee?.fee_type ?? 'per_door'} className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                <option value="per_door">Per door / month</option>
                <option value="flat_monthly">Flat monthly</option>
                <option value="percentage">% of assessments</option>
              </select>
            </div>
            <div>
              <Label htmlFor="fee_amount">Amount</Label>
              <Input id="fee_amount" name="fee_amount" inputMode="decimal" placeholder="e.g. 22" />
            </div>
            <div>
              <Label htmlFor="effective_from">Effective from</Label>
              <Input id="effective_from" name="effective_from" type="date" />
            </div>
            <div className="flex items-end justify-end">
              <Button type="submit">Save fee</Button>
            </div>
            <div className="sm:col-span-4">
              <Label htmlFor="fee_notes">Notes</Label>
              <Input id="fee_notes" name="fee_notes" placeholder="e.g. Renegotiated at 2026 renewal" />
            </div>
          </form>
        </Section>
      </div>

      <div className="mt-6">
        <Section title="Reserve Fund" padded>
          <p className="mb-4 text-sm leading-6 text-gray-500">
            Reserve study targets and contribution schedule. Feeds the Reserve Fund Analysis report;
            actual reserve balances come from bank accounts designated fund type &quot;reserve&quot;.
          </p>
          <form action={saveReserveSettings} className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="target_amount">Target funding level ($)</Label>
              <Input id="target_amount" name="target_amount" defaultValue={reserve?.target_amount ?? ''} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="monthly_contribution">Monthly contribution ($)</Label>
              <Input id="monthly_contribution" name="monthly_contribution" defaultValue={reserve?.monthly_contribution ?? ''} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="percent_funded">Percent funded (last study, %)</Label>
              <Input id="percent_funded" name="percent_funded" defaultValue={reserve?.percent_funded ?? ''} inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="last_study_date">Last reserve study</Label>
              <Input id="last_study_date" name="last_study_date" type="date" defaultValue={reserve?.last_study_date ?? ''} />
            </div>
            <div>
              <Label htmlFor="next_study_due">Next study due</Label>
              <Input id="next_study_due" name="next_study_due" type="date" defaultValue={reserve?.next_study_due ?? ''} />
            </div>
            <div>
              <Label htmlFor="reserve_notes">Notes</Label>
              <Input id="reserve_notes" name="reserve_notes" defaultValue={reserve?.notes ?? ''} />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit">Save reserve settings</Button>
            </div>
          </form>
        </Section>
      </div>

      <div className="mt-6">
        <Section title={`Loans & Mortgages (${loans?.length ?? 0})`} padded>
          {(loans ?? []).length > 0 && (
            <ul className="mb-4 divide-y divide-gray-100">
              {(loans ?? []).map((l: any) => (
                <li key={l.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <span className="font-medium text-gray-900">{l.lender}</span>
                    <span className="ml-2 text-xs capitalize text-gray-500">{String(l.loan_type).replace(/_/g, ' ')}</span>
                    <div className="text-xs text-gray-500">
                      {l.current_balance != null ? `Balance $${Number(l.current_balance).toLocaleString()}` : 'No balance'}
                      {l.interest_rate != null ? ` · ${l.interest_rate}%` : ''}
                      {l.payment_amount != null ? ` · $${Number(l.payment_amount).toLocaleString()}/${l.payment_frequency ?? 'mo'}` : ''}
                      {l.next_payment_date ? ` · next ${date(l.next_payment_date)}` : ''}
                      {l.maturity_date ? ` · matures ${date(l.maturity_date)}` : ''}
                    </div>
                  </div>
                  <form action={archiveLoan.bind(null, l.id)}>
                    <button type="submit" className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-red-600">Archive</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-950">+ Add loan / mortgage</summary>
            <form action={addLoan} className="mt-4 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="lender">Lender *</Label>
                <Input id="lender" name="lender" required />
              </div>
              <div>
                <Label htmlFor="loan_type">Type</Label>
                <select id="loan_type" name="loan_type" defaultValue="mortgage" className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                  <option value="mortgage">Mortgage</option>
                  <option value="line_of_credit">Line of credit</option>
                  <option value="note">Note</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="original_principal">Original principal ($)</Label>
                <Input id="original_principal" name="original_principal" inputMode="decimal" />
              </div>
              <div>
                <Label htmlFor="current_balance">Current balance ($)</Label>
                <Input id="current_balance" name="current_balance" inputMode="decimal" />
              </div>
              <div>
                <Label htmlFor="interest_rate">Interest rate (%)</Label>
                <Input id="interest_rate" name="interest_rate" inputMode="decimal" />
              </div>
              <div>
                <Label htmlFor="term_months">Term (months)</Label>
                <Input id="term_months" name="term_months" inputMode="numeric" />
              </div>
              <div>
                <Label htmlFor="payment_amount">Payment amount ($)</Label>
                <Input id="payment_amount" name="payment_amount" inputMode="decimal" />
              </div>
              <div>
                <Label htmlFor="next_payment_date">Next payment date</Label>
                <Input id="next_payment_date" name="next_payment_date" type="date" />
              </div>
              <div>
                <Label htmlFor="start_date">Start date</Label>
                <Input id="start_date" name="start_date" type="date" />
              </div>
              <div>
                <Label htmlFor="maturity_date">Maturity date</Label>
                <Input id="maturity_date" name="maturity_date" type="date" />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit">Add loan</Button>
              </div>
            </form>
          </details>
        </Section>
      </div>
    </Workspace>
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}
