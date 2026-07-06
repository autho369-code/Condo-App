import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Alert } from '@/components/ui/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { resolveAssociation } from '@/lib/associations/resolve';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/operations/status-chip';
import { date } from '@/lib/utils';
import { CreditCard, ExternalLink, RefreshCcw } from 'lucide-react';

export const dynamic = 'force-dynamic';

const card = 'rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]';
const SITE_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://portier369.com';

async function connectStripe(formData: FormData) {
  'use server';
  const { requireStaff: req } = await import('@/lib/auth/me');
  await req();
  const associationId = formData.get('association_id') as string;
  const slug = (formData.get('slug') as string) || associationId;
  const back = `/associations/${slug}/payments`;

  const { isStripeConfigured, createConnectedAccount, createAccountLink } = await import('@/lib/payments/stripe');
  if (!isStripeConfigured()) {
    redirect(`${back}?error=${encodeURIComponent('Platform Stripe keys are not set yet (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET in Vercel).')}`);
  }

  const { createServiceClient } = await import('@/lib/supabase/server');
  const svc = createServiceClient() as any;
  const { data: assoc } = await svc.from('associations').select('id, name, stripe_account_id').eq('id', associationId).maybeSingle();
  if (!assoc) redirect(`${back}?error=${encodeURIComponent('Association not found.')}`);

  let accountId = assoc.stripe_account_id as string | null;
  try {
    if (!accountId) {
      const account = await createConnectedAccount({ associationName: assoc.name });
      accountId = account.id;
      await svc.from('associations').update({ stripe_account_id: accountId }).eq('id', associationId);
    }
    const link = await createAccountLink(
      accountId!,
      `${SITE_URL}/associations/${slug}/payments?refresh=1`,
      `${SITE_URL}/associations/${slug}/payments?returned=1`,
    );
    redirect(link.url);
  } catch (err: any) {
    if (err?.digest?.startsWith?.('NEXT_REDIRECT')) throw err;
    redirect(`${back}?error=${encodeURIComponent(err?.message ?? 'Stripe onboarding could not be started.')}`);
  }
}

const ALLOCATION_CLASSES = [
  { value: 'late_fee', label: 'Late Fees' },
  { value: 'nsf_fee', label: 'NSF Fees' },
  { value: 'fine', label: 'Fines / Violations' },
  { value: 'interest', label: 'Interest' },
  { value: 'legal', label: 'Legal' },
  { value: 'special_assessment', label: 'Special Assessments' },
  { value: 'assessment', label: 'Assessments' },
  { value: 'other', label: 'Everything Else' },
] as const;

async function saveAllocationOrder(formData: FormData) {
  'use server';
  const { requireStaff: req } = await import('@/lib/auth/me');
  await req();
  const associationId = formData.get('association_id') as string;
  const slug = (formData.get('slug') as string) || associationId;
  const back = `/associations/${slug}/payments`;

  const order: string[] = [];
  for (let i = 0; i < ALLOCATION_CLASSES.length; i++) {
    const v = (formData.get(`priority_${i}`) as string) || '';
    if (v) order.push(v);
  }
  const allowed = new Set(ALLOCATION_CLASSES.map((c) => c.value as string));
  const unique = [...new Set(order)].filter((v) => allowed.has(v));
  if (unique.length !== ALLOCATION_CLASSES.length) {
    redirect(`${back}?error=${encodeURIComponent('Each charge class must appear exactly once in the allocation order.')}`);
  }

  const { createClient: cc } = await import('@/lib/supabase/server');
  const supabase = await cc();
  const { error } = await (supabase as any)
    .from('associations')
    .update({ payment_allocation_order: unique })
    .eq('id', associationId);
  if (error) redirect(`${back}?error=${encodeURIComponent(error.message)}`);
  redirect(`${back}?allocation_saved=1`);
}

async function refreshStripeStatus(formData: FormData) {
  'use server';
  const { requireStaff: req } = await import('@/lib/auth/me');
  await req();
  const associationId = formData.get('association_id') as string;
  const slug = (formData.get('slug') as string) || associationId;
  const back = `/associations/${slug}/payments`;

  const { isStripeConfigured, getConnectedAccount } = await import('@/lib/payments/stripe');
  const { createServiceClient } = await import('@/lib/supabase/server');
  const svc = createServiceClient() as any;
  const { data: assoc } = await svc.from('associations').select('id, stripe_account_id').eq('id', associationId).maybeSingle();
  if (!assoc?.stripe_account_id || !isStripeConfigured()) redirect(back);

  try {
    const account = await getConnectedAccount(assoc.stripe_account_id);
    await svc.from('associations').update({
      stripe_charges_enabled: !!account.charges_enabled,
      stripe_details_submitted: !!account.details_submitted,
      ...(account.charges_enabled ? { stripe_onboarded_at: new Date().toISOString() } : {}),
    }).eq('id', associationId);
  } catch (err: any) {
    if (err?.digest?.startsWith?.('NEXT_REDIRECT')) throw err;
    redirect(`${back}?error=${encodeURIComponent(err?.message ?? 'Could not refresh Stripe status.')}`);
  }
  redirect(`${back}?refreshed=1`);
}

export default async function AssociationPaymentsTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; returned?: string; refreshed?: string; refresh?: string; allocation_saved?: string }>;
}) {
  await requireStaff();
  const { id: assocParam } = await params;
  const association = await resolveAssociation(assocParam);
  if (!association) notFound();
  const id = association.id;
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const { data: assoc } = await db
    .from('associations')
    .select('id, name, slug, stripe_account_id, stripe_charges_enabled, stripe_details_submitted, stripe_onboarded_at, remit_payee, remit_address, payment_instructions, payment_allocation_order')
    .eq('id', id)
    .maybeSingle();
  if (!assoc) notFound();

  const { isStripeConfigured } = await import('@/lib/payments/stripe');
  const platformReady = isStripeConfigured();
  const slug = assoc.slug ?? assoc.id;

  const state = !assoc.stripe_account_id
    ? 'not_connected'
    : assoc.stripe_charges_enabled
      ? 'active'
      : 'onboarding';

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">{assoc.name}</h1>
        <p className="mt-1 text-sm text-gray-500">Online payments — this association&apos;s own Stripe account and bank</p>
      </div>
      <AssociationTabs associationId={assocParam} active="payments" />

      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Stripe error">{sp.error}</Alert>}
        {sp.returned && <Alert tone="success" title="Welcome back from Stripe">If onboarding was completed, the status below updates automatically (or click Refresh status).</Alert>}
        {sp.refreshed && <Alert tone="success" title="Status refreshed">Latest account state pulled from Stripe.</Alert>}

        {!platformReady && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-900">
            The platform Stripe keys aren&apos;t set yet (<code className="rounded bg-blue-100 px-1">STRIPE_SECRET_KEY</code>,{' '}
            <code className="rounded bg-blue-100 px-1">STRIPE_WEBHOOK_SECRET</code> in Vercel). Once they are, connect
            each association from this page.
          </div>
        )}

        <div className={card}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-inset ring-gray-200/70">
                <CreditCard className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-950">Association Stripe Account</h2>
                <p className="mt-0.5 max-w-md text-[13px] leading-5 text-gray-500">
                  Each association has its own Stripe account settling to its own bank — owner payments never mix with
                  any other association&apos;s funds.
                </p>
              </div>
            </div>
            <StatusChip tone={state === 'active' ? 'success' : state === 'onboarding' ? 'warning' : 'neutral'}>
              {state === 'active' ? 'Active' : state === 'onboarding' ? 'Onboarding incomplete' : 'Not connected'}
            </StatusChip>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Stripe Account</dt>
              <dd className="mt-0.5 font-mono text-xs text-gray-900">{assoc.stripe_account_id ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Charges Enabled</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{assoc.stripe_charges_enabled ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Details Submitted</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{assoc.stripe_details_submitted ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Onboarded</dt>
              <dd className="mt-0.5 text-sm text-gray-900">{assoc.stripe_onboarded_at ? date(assoc.stripe_onboarded_at) : '—'}</dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            <form action={connectStripe as any}>
              <input type="hidden" name="association_id" value={assoc.id} />
              <input type="hidden" name="slug" value={slug} />
              <Button type="submit" disabled={!platformReady} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                {state === 'not_connected' ? 'Connect Stripe account' : 'Continue Stripe onboarding'}
              </Button>
            </form>
            {assoc.stripe_account_id && (
              <form action={refreshStripeStatus as any}>
                <input type="hidden" name="association_id" value={assoc.id} />
                <input type="hidden" name="slug" value={slug} />
                <Button type="submit" variant="secondary" className="gap-2" disabled={!platformReady}>
                  <RefreshCcw className="h-4 w-4" /> Refresh status
                </Button>
              </form>
            )}
          </div>

          <p className="mt-4 text-[12px] leading-5 text-gray-400">
            Onboarding is completed on Stripe by the association (EIN, bank account for deposits). When Charges Enabled
            turns on, owners see &quot;Pay online&quot; automatically on their How to Pay page.
          </p>
        </div>

        {sp.allocation_saved && <Alert tone="success" title="Allocation order saved">New payments now apply to charges in this order.</Alert>}

        <div className={card}>
          <h2 className="text-sm font-semibold text-gray-950">Payment Allocation Policy</h2>
          <p className="mt-1 max-w-lg text-[13px] leading-5 text-gray-500">
            When an owner pays without picking a specific charge, the payment applies to open charges in this order
            (oldest first within each class). Every association can set its own policy.
          </p>
          <form action={saveAllocationOrder as any} className="mt-4 space-y-2.5">
            <input type="hidden" name="association_id" value={assoc.id} />
            <input type="hidden" name="slug" value={slug} />
            {ALLOCATION_CLASSES.map((_, i) => {
              const current = (assoc.payment_allocation_order ?? [])[i] ?? ALLOCATION_CLASSES[i].value;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 text-right text-sm font-semibold tabular-nums text-gray-400">{i + 1}.</span>
                  <select
                    name={`priority_${i}`}
                    defaultValue={current}
                    className="h-9 w-64 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                  >
                    {ALLOCATION_CLASSES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
            <div className="pt-2">
              <Button type="submit">Save allocation order</Button>
            </div>
          </form>
        </div>

        <div className={card}>
          <h2 className="text-sm font-semibold text-gray-950">Offline Instructions (always shown to owners)</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Checks payable to</dt>
              <dd className="mt-0.5 text-gray-900">{assoc.remit_payee ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Mail to</dt>
              <dd className="mt-0.5 whitespace-pre-line text-gray-900">{assoc.remit_address ?? '—'}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[12px] leading-5 text-gray-400">Edit these on the Association tab.</p>
        </div>
      </div>
    </div>
  );
}
