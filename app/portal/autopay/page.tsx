import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { StatusChip } from '@/components/operations/status-chip';
import { date, money } from '@/lib/utils';
import { RefreshCcw, PauseCircle, PlayCircle, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const card = 'rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
const SITE_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portier369.com';
const RETURN = '/portal/autopay';

const MODES = [
  { value: 'current_balance', label: 'Pay my current balance', hint: 'Whatever you owe on the run date' },
  { value: 'fixed', label: 'Fixed monthly amount', hint: 'Same amount every month' },
  { value: 'recurring_only', label: 'Recurring assessments only', hint: 'Regular dues, not one-time charges' },
  { value: 'special_only', label: 'Special assessments only', hint: 'Only special-assessment charges' },
  { value: 'minimum', label: 'Minimum amount', hint: 'A floor amount you set' },
];

async function startAutopaySetup(formData: FormData) {
  'use server';
  const me = await requireOwner();
  const { isStripeConfigured, createSetupCheckoutSession } = await import('@/lib/payments/stripe');
  if (!isStripeConfigured()) redirect(`${RETURN}?error=${encodeURIComponent('Online payments are not enabled yet.')}`);

  const unitId = (formData.get('unit_id') as string) || '';
  const mode = (formData.get('mode') as string) || 'current_balance';
  const day = Math.min(28, Math.max(1, Number(formData.get('day_of_month') || 1)));
  const maxAmount = Number(((formData.get('max_amount') as string) || '').replace(/[$,]/g, ''));
  const fixedAmount = Number(((formData.get('fixed_amount') as string) || '').replace(/[$,]/g, ''));
  const minimumAmount = Number(((formData.get('minimum_amount') as string) || '').replace(/[$,]/g, ''));
  const includeLateFees = formData.get('include_late_fees') === 'on';

  if (!unitId) redirect(`${RETURN}?error=${encodeURIComponent('Pick a unit.')}`);
  if (!Number.isFinite(maxAmount) || maxAmount < 1) redirect(`${RETURN}?error=${encodeURIComponent('Set a maximum withdrawal amount (your safety cap).')}`);
  if (mode === 'fixed' && (!Number.isFinite(fixedAmount) || fixedAmount < 1)) redirect(`${RETURN}?error=${encodeURIComponent('Enter the fixed monthly amount.')}`);
  if (mode === 'minimum' && (!Number.isFinite(minimumAmount) || minimumAmount < 1)) redirect(`${RETURN}?error=${encodeURIComponent('Enter the minimum amount.')}`);

  const svc = createServiceClient() as any;
  const { data: occ } = await svc
    .from('occupancies')
    .select('unit_id, association_id, associations(portfolio_id, name, stripe_account_id, stripe_charges_enabled)')
    .eq('owner_id', me.owner_id)
    .eq('unit_id', unitId)
    .eq('status', 'current')
    .maybeSingle();
  if (!occ?.associations?.stripe_account_id || !occ.associations.stripe_charges_enabled) {
    redirect(`${RETURN}?error=${encodeURIComponent('Online payments are not enabled for your association yet.')}`);
  }

  try {
    const session = await createSetupCheckoutSession({
      customerEmail: me.profile?.email ?? null,
      successUrl: `${SITE_URL}/portal/autopay?enrolled=1`,
      cancelUrl: `${SITE_URL}/portal/autopay?canceled=1`,
      stripeAccount: occ.associations.stripe_account_id,
      metadata: {
        purpose: 'autopay_setup',
        owner_id: me.owner_id!,
        unit_id: unitId,
        association_id: occ.association_id,
        portfolio_id: occ.associations.portfolio_id,
        mode,
        day_of_month: String(day),
        max_cents: String(Math.round(maxAmount * 100)),
        fixed_cents: mode === 'fixed' ? String(Math.round(fixedAmount * 100)) : '',
        minimum_cents: mode === 'minimum' ? String(Math.round(minimumAmount * 100)) : '',
        include_late_fees: includeLateFees ? 'true' : 'false',
      },
    });
    redirect(session.url);
  } catch (err: any) {
    if (err?.digest?.startsWith?.('NEXT_REDIRECT')) throw err;
    redirect(`${RETURN}?error=${encodeURIComponent(err?.message ?? 'Could not start AutoPay setup.')}`);
  }
}

async function updateMandate(formData: FormData) {
  'use server';
  const me = await requireOwner();
  const mandateId = formData.get('mandate_id') as string;
  const action = formData.get('do') as string;
  const svc = createServiceClient() as any;

  const { data: mandate } = await svc.from('autopay_mandates').select('id, owner_id, next_run_date, day_of_month').eq('id', mandateId).maybeSingle();
  if (!mandate || mandate.owner_id !== me.owner_id) redirect(`${RETURN}?error=${encodeURIComponent('AutoPay enrollment not found.')}`);

  const updates: any = { updated_at: new Date().toISOString() };
  if (action === 'skip_month') {
    // Skip exactly the next scheduled run.
    updates.skip_until = mandate.next_run_date ?? new Date().toISOString().slice(0, 10);
  } else if (action === 'vacation') {
    const until = (formData.get('until') as string) || '';
    if (!until) redirect(`${RETURN}?error=${encodeURIComponent('Pick the date your vacation hold ends.')}`);
    updates.skip_until = until;
    updates.paused_reason = 'vacation mode';
  } else if (action === 'resume') {
    updates.skip_until = null;
    updates.paused_reason = null;
  } else if (action === 'cancel') {
    updates.status = 'canceled';
    updates.canceled_at = new Date().toISOString();
  }
  await svc.from('autopay_mandates').update(updates).eq('id', mandateId);
  redirect(`${RETURN}?updated=1`);
}

export default async function AutopayPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enrolled?: string; canceled?: string; updated?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireOwner();
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: mandates }, { data: occs }] = await Promise.all([
    db.from('autopay_mandates')
      .select('*, units(unit_number), payment_methods(brand, last_four, method_type, bank_name), associations(name)')
      .eq('owner_id', me.owner_id)
      .neq('status', 'canceled')
      .order('created_at', { ascending: false }),
    db.from('occupancies')
      .select('unit_id, units(unit_number), associations(id, name, stripe_charges_enabled)')
      .eq('owner_id', me.owner_id)
      .eq('status', 'current'),
  ]);

  const activeMandateUnitIds = new Set((mandates ?? []).map((m: any) => m.unit_id));
  const enrollableUnits = (occs ?? []).filter(
    (o: any) => o.associations?.stripe_charges_enabled && !activeMandateUnitIds.has(o.unit_id),
  );
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">AutoPay</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Set it once — your assessments pay themselves, with a maximum-withdrawal cap you control
        </p>
      </div>

      {sp.error && <Alert tone="danger" title="AutoPay error">{sp.error}</Alert>}
      {sp.enrolled && <Alert tone="success" title="Payment method saved">Your AutoPay enrollment activates as soon as Stripe confirms the saved payment method (usually instant).</Alert>}
      {sp.canceled && <Alert tone="warning" title="Setup canceled">No payment method was saved. You can start again below.</Alert>}
      {sp.updated && <Alert tone="success" title="AutoPay updated">Your changes are saved.</Alert>}

      {/* ── Active enrollments ────────────────────────── */}
      {(mandates ?? []).map((m: any) => {
        const onHold = m.skip_until && m.skip_until >= today;
        return (
          <div key={m.id} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-950">
                  Unit {m.units?.unit_number ?? '—'} — {m.associations?.name ?? ''}
                </h2>
                <p className="mt-0.5 text-[13px] text-gray-500">
                  {MODES.find((x) => x.value === m.mode)?.label ?? m.mode}
                  {m.mode === 'fixed' && m.fixed_amount_cents ? ` (${money(m.fixed_amount_cents / 100)})` : ''}
                  {m.mode === 'minimum' && m.minimum_amount_cents ? ` (${money(m.minimum_amount_cents / 100)})` : ''}
                  {' · '}day {m.day_of_month ?? 1} of each month
                  {' · '}cap {money((m.authorized_amount_max_cents ?? 0) / 100)}
                  {m.include_late_fees ? ' · includes late fees' : ' · excludes late fees'}
                </p>
                <p className="mt-0.5 text-[13px] text-gray-500">
                  {m.payment_methods?.method_type === 'ach'
                    ? `Bank ${m.payment_methods?.bank_name ?? ''} ••••${m.payment_methods?.last_four ?? ''}`
                    : `${(m.payment_methods?.brand ?? 'Card').toUpperCase()} ••••${m.payment_methods?.last_four ?? ''}`}
                  {' · '}next run {date(m.next_run_date)}
                </p>
              </div>
              <StatusChip tone={onHold ? 'warning' : 'success'}>{onHold ? `On hold until ${date(m.skip_until)}` : 'Active'}</StatusChip>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-2">
              {!onHold && (
                <form action={updateMandate as any}>
                  <input type="hidden" name="mandate_id" value={m.id} />
                  <input type="hidden" name="do" value="skip_month" />
                  <Button type="submit" variant="secondary" className="gap-1.5"><PauseCircle className="h-4 w-4" /> Skip next month</Button>
                </form>
              )}
              {!onHold && (
                <form action={updateMandate as any} className="flex items-end gap-2">
                  <input type="hidden" name="mandate_id" value={m.id} />
                  <input type="hidden" name="do" value="vacation" />
                  <label className="text-xs font-medium text-gray-600">
                    Vacation mode until
                    <input type="date" name="until" min={today} className="mt-1 block h-9 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                  </label>
                  <Button type="submit" variant="secondary" className="gap-1.5"><PauseCircle className="h-4 w-4" /> Hold</Button>
                </form>
              )}
              {onHold && (
                <form action={updateMandate as any}>
                  <input type="hidden" name="mandate_id" value={m.id} />
                  <input type="hidden" name="do" value="resume" />
                  <Button type="submit" variant="secondary" className="gap-1.5"><PlayCircle className="h-4 w-4" /> Resume now</Button>
                </form>
              )}
              <form action={updateMandate as any}>
                <input type="hidden" name="mandate_id" value={m.id} />
                <input type="hidden" name="do" value="cancel" />
                <Button type="submit" variant="secondary" className="gap-1.5 text-red-700 hover:bg-red-50"><XCircle className="h-4 w-4" /> Cancel AutoPay</Button>
              </form>
            </div>
          </div>
        );
      })}

      {/* ── Enrollment ────────────────────────────────── */}
      {enrollableUnits.length > 0 ? (
        <div className={card}>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-950">
              <RefreshCcw className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-950">Set Up AutoPay</h2>
              <p className="text-xs text-gray-500">Choose how much to pay, when, and your safety cap — then save a card or bank account securely with Stripe</p>
            </div>
          </div>
          <form action={startAutopaySetup as any} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="unit_id">Unit</Label>
                <select id="unit_id" name="unit_id" className="mt-1 block h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                  {enrollableUnits.map((o: any) => (
                    <option key={o.unit_id} value={o.unit_id}>Unit {o.units?.unit_number ?? '—'} — {o.associations?.name ?? ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="mode">What should AutoPay cover?</Label>
                <select id="mode" name="mode" className="mt-1 block h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                  {MODES.map((mo) => (
                    <option key={mo.value} value={mo.value}>{mo.label} — {mo.hint}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="fixed_amount">Fixed amount (fixed mode only)</Label>
                <Input id="fixed_amount" name="fixed_amount" inputMode="decimal" placeholder="e.g. 350.00" />
              </div>
              <div>
                <Label htmlFor="minimum_amount">Minimum amount (minimum mode only)</Label>
                <Input id="minimum_amount" name="minimum_amount" inputMode="decimal" placeholder="e.g. 100.00" />
              </div>
              <div>
                <Label htmlFor="max_amount">Maximum withdrawal per run (required cap)</Label>
                <Input id="max_amount" name="max_amount" inputMode="decimal" required placeholder="e.g. 500.00" />
              </div>
              <div>
                <Label htmlFor="day_of_month">Run on day of month (1–28)</Label>
                <Input id="day_of_month" name="day_of_month" type="number" min={1} max={28} defaultValue={1} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="include_late_fees" defaultChecked className="h-4 w-4 rounded border-gray-300" />
              Automatically include late fees, NSF fees, and fines
            </label>
            <Button type="submit">Save payment method &amp; activate</Button>
            <p className="text-[12px] leading-5 text-gray-400">
              You&apos;ll be taken to Stripe to securely save a bank account (ACH) or card. AutoPay never withdraws more
              than your cap, and you can skip a month, set vacation mode, or cancel any time.
            </p>
          </form>
        </div>
      ) : (mandates ?? []).length === 0 ? (
        <div className={`${card} text-center`}>
          <p className="text-sm text-gray-500">
            AutoPay becomes available once your association enables online payments.
            Meanwhile, see <Link href="/portal/pay" className="font-medium text-gray-700 underline">How to Pay</Link>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
