import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardSubtitle, CardBody } from '@/components/ui/card';
import { Input, Field } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/operations/status-chip';
import { createOwnerCheckoutSession } from '@/lib/rpcs/checkout';
import { isStripePaymentsConfigured } from '@/lib/payments/config';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type UnitAccountSummary = {
  unit_id: string | null;
  unit_number: string | null;
  association_id: string | null;
  outstanding_balance?: number | string | null;
  unapplied_credit?: number | string | null;
  total_charged?: number | string | null;
  total_paid?: number | string | null;
};

type AssociationOption = { id: string; name: string };

export default async function PayPage() {
  const me = await requireAuth();
  const supabase = await createClient();
  const paymentsEnabled = isStripePaymentsConfigured();

  const { data: units } = await (supabase as any)
    .from('v_unit_account_summary')
    .select('*')
    .order('association_id');

  const unitOptions = (units ?? []) as UnitAccountSummary[];
  const associationIds = Array.from(
    new Set(unitOptions.map((u) => u.association_id).filter((id): id is string => Boolean(id))),
  );
  const { data: associations } = associationIds.length
    ? await (supabase as any).from('associations').select('id, name').in('id', associationIds)
    : { data: [] };
  const associationNameById = new Map<string, string>(
    ((associations ?? []) as AssociationOption[]).map((a) => [a.id, a.name]),
  );

  const defaultUnit =
    unitOptions.find((u) => Number(u.outstanding_balance) > 0) ?? unitOptions[0];
  const defaultAmount = Math.max(0, Number(defaultUnit?.outstanding_balance ?? 0));

  const policy = {
    label:   me.portfolio?.convenience_fee_label ?? 'Processing fee',
    cardPct: Number(me.portfolio?.convenience_fee_card_pct ?? 2.9),
    mode:    me.portfolio?.convenience_fee_mode ?? 'pass_through',
  };
  const passThrough = policy.mode === 'pass_through';

  return (
    <div className="space-y-9">
      {/* Editorial header */}
      <header className="border-b border-ink-100 pb-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <div className="eyebrow">Pay assessment</div>
            <h1 className="mt-2 font-display text-4xl tracking-editorial text-ink-900">
              Settle your{' '}
              <span className="italic text-champagne-700">balance.</span>
            </h1>
            <p className="mt-3 text-[15px] text-ink-500 leading-relaxed">
              Confirm the amount, choose a method, and we'll route you to a
              secure checkout. The system applies your payment to the oldest
              open charges first.
            </p>
          </div>
          <Link href="/portal">
            <Button variant="outline" size="md">← Back to portal</Button>
          </Link>
        </div>
      </header>

      {/* No units linked */}
      {!units?.length && (
        <Card>
          <CardBody className="py-10 text-center">
            <div className="font-display text-xl tracking-editorial text-ink-900">
              No units linked to your account.
            </div>
            <p className="mt-2 text-sm text-ink-500">
              Ask your management company to finish the portal setup.
            </p>
          </CardBody>
        </Card>
      )}

      {defaultUnit && (
        <>
          {/* ============ ACCOUNT SUMMARY CARD ============ */}
          <Card>
            <CardHeader>
              <CardTitle>{formatUnitLabel(defaultUnit, associationNameById)}</CardTitle>
              <CardSubtitle>
                Your account snapshot. Pay any amount — credit balances apply automatically.
              </CardSubtitle>
            </CardHeader>
            <CardBody className="px-0 py-0">
              <div className="grid grid-cols-3 gap-px overflow-hidden border-y border-ink-100 bg-ink-100">
                <SummaryCell
                  label="Charged this period"
                  value={money(defaultUnit.total_charged)}
                />
                <SummaryCell
                  label="Paid this period"
                  value={money(defaultUnit.total_paid)}
                  tone="positive"
                />
                <SummaryCell
                  label="Outstanding"
                  value={money(defaultUnit.outstanding_balance)}
                  tone={Number(defaultUnit.outstanding_balance) > 0 ? 'danger' : 'positive'}
                />
              </div>
              {Number(defaultUnit.unapplied_credit) > 0 && (
                <div className="px-6 py-4 text-sm text-sage-700 bg-sage-50/60">
                  <span className="font-medium">{money(defaultUnit.unapplied_credit)}</span>{' '}
                  credit on file — will apply to your next charge automatically.
                </div>
              )}
            </CardBody>
          </Card>

          {/* ============ PAYMENT NOT YET CONFIGURED ============ */}
          {!paymentsEnabled ? (
            <Card>
              <CardHeader>
                <CardTitle>Online payments coming soon</CardTitle>
                <CardSubtitle>
                  Stripe checkout is being configured for {me.portfolio?.company_name ?? 'this portal'}.
                  Until then, please use your management company's existing payment instructions.
                </CardSubtitle>
              </CardHeader>
              <CardBody>
                <div className="flex flex-wrap gap-3">
                  <Link href="/portal/ledger">
                    <Button variant="outline" size="md">View ledger</Button>
                  </Link>
                  <Link href="/portal/statement">
                    <Button variant="outline" size="md">Printable statement</Button>
                  </Link>
                </div>
              </CardBody>
            </Card>
          ) : (
            /* ============ CHECKOUT FORM ============ */
            <form action={createOwnerCheckoutSession as any} className="space-y-7">
              <input type="hidden" name="unit_id" value={defaultUnit.unit_id ?? ''} />

              {/* Amount */}
              <Card>
                <CardHeader>
                  <CardTitle>Amount</CardTitle>
                  <CardSubtitle>
                    Defaults to your full outstanding balance. Adjust if you'd like to pay less.
                  </CardSubtitle>
                </CardHeader>
                <CardBody>
                  <Field label="Amount to pay">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-lg text-ink-500">$</span>
                      <Input
                        id="amount"
                        name="amount"
                        type="number"
                        step="0.01"
                        min="1"
                        defaultValue={defaultAmount.toFixed(2)}
                        className="pl-9 text-lg font-display tracking-editorial"
                        required
                      />
                    </div>
                  </Field>
                </CardBody>
              </Card>

              {/* Payment method */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment method</CardTitle>
                  <CardSubtitle>Pick how you'd like to pay. Both options are processed by Stripe.</CardSubtitle>
                </CardHeader>
                <CardBody>
                  <fieldset className="grid gap-3 md:grid-cols-2">
                    <legend className="sr-only">Payment method</legend>

                    <MethodCard
                      value="ach"
                      defaultChecked
                      title="Bank account"
                      subtitle="ACH / eCheck"
                      eyebrow="Recommended"
                      eyebrowTone="success"
                      detail={passThrough ? 'No fee. Funds settle in 3–5 business days.' : 'Funds settle in 3–5 business days.'}
                    />
                    <MethodCard
                      value="card"
                      title="Debit or credit card"
                      subtitle="Posts immediately"
                      detail={
                        passThrough
                          ? `A ${policy.cardPct}% ${policy.label.toLowerCase()} is added at checkout.`
                          : 'No fee. Posts immediately.'
                      }
                    />
                  </fieldset>

                  {passThrough && (
                    <div className="mt-5 rounded-md border border-champagne-300 bg-champagne-50 px-4 py-3 text-[13px] text-champagne-800">
                      Card payments include a{' '}
                      <span className="font-semibold">{policy.cardPct}% {policy.label}</span>.
                      ACH is fee-free.
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Multiple units */}
              {(units ?? []).length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Which unit?</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <Field label="Unit">
                      <select
                        id="unit_id_picker"
                        name="unit_id"
                        defaultValue={defaultUnit.unit_id ?? ''}
                        className="h-10 w-full rounded-md border border-ink-200 bg-white px-3.5 text-sm text-ink-900 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60 transition-colors"
                      >
                        {units!.map((u: any) => (
                          <option key={u.unit_id} value={u.unit_id ?? ''}>
                            {formatUnitLabel(u, associationNameById)} · balance {money(u.outstanding_balance)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </CardBody>
                </Card>
              )}

              {/* Submit */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-7">
                <p className="max-w-md text-xs text-ink-500 leading-relaxed">
                  Your card / bank details are entered on Stripe's secure checkout — they never touch our servers.
                </p>
                <div className="flex w-full items-center gap-3 sm:w-auto">
                  <Link href="/portal" className="hidden sm:inline-flex">
                    <Button variant="outline" size="md" type="button">Cancel</Button>
                  </Link>
                  <Button type="submit" size="lg" variant="primary" className="w-full sm:w-auto">
                    Continue to secure checkout →
                  </Button>
                </div>
              </div>
            </form>
          )}

          {/* ============ AUTOPAY UPSELL ============ */}
          <Link href="/portal/autopay" className="block">
            <Card className="cursor-pointer transition-all hover:border-champagne-300 hover:shadow-soft hover:-translate-y-px">
              <CardBody>
                <div className="flex items-center justify-between gap-6">
                  <div>
                    <div className="eyebrow">Set it and forget it</div>
                    <div className="mt-2 font-display text-lg tracking-editorial text-ink-900">
                      Enrol in autopay
                    </div>
                    <p className="mt-1 text-sm text-ink-500">
                      Pay dues automatically via ACH each month. No more late fees, no more reminders.
                    </p>
                  </div>
                  <span className="font-display text-2xl text-champagne-700">→</span>
                </div>
              </CardBody>
            </Card>
          </Link>
        </>
      )}
    </div>
  );
}

// =============================================================================
// helpers
// =============================================================================

function SummaryCell({
  label, value, tone,
}: { label: string; value: React.ReactNode; tone?: 'positive' | 'danger' }) {
  const cls =
    tone === 'positive' ? 'text-sage-700' :
    tone === 'danger'   ? 'text-bordeaux-700' :
    'text-ink-900';
  return (
    <div className="bg-white px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1.5 font-display text-2xl number-plate tracking-editorial ${cls}`}>{value}</div>
    </div>
  );
}

function MethodCard({
  value, defaultChecked, title, subtitle, detail, eyebrow, eyebrowTone,
}: {
  value: 'ach' | 'card';
  defaultChecked?: boolean;
  title: string;
  subtitle: string;
  detail: string;
  eyebrow?: string;
  eyebrowTone?: 'success' | 'accent';
}) {
  return (
    <label
      className="
        group relative cursor-pointer rounded-lg border border-ink-200 bg-white p-5
        transition-all hover:border-ink-300 hover:shadow-soft-sm
        has-[:checked]:border-ink-900 has-[:checked]:bg-ink-900/[0.025] has-[:checked]:shadow-soft
      "
    >
      <input type="radio" name="method" value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      {/* Selection ring indicator */}
      <span
        aria-hidden="true"
        className="
          absolute right-4 top-4 inline-flex h-5 w-5 items-center justify-center rounded-full
          border border-ink-200 bg-white transition-colors
          peer-checked:border-ink-900 peer-checked:bg-ink-900
        "
      >
        <span className="h-2 w-2 rounded-full bg-cream-50 opacity-0 peer-checked:opacity-100 transition-opacity" />
      </span>

      {eyebrow && (
        <div className="mb-2">
          <StatusChip tone={eyebrowTone ?? 'accent'}>{eyebrow}</StatusChip>
        </div>
      )}
      <div className="font-display text-lg tracking-editorial text-ink-900">{title}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-500">{subtitle}</div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-600">{detail}</p>
    </label>
  );
}

function formatUnitLabel(
  unit: { association_id: string | null; unit_number: string | null },
  associationNameById: Map<string, string>,
): string {
  const associationName = unit.association_id
    ? associationNameById.get(unit.association_id) ?? 'Association'
    : 'Association';
  return `${associationName} · Unit ${unit.unit_number ?? '—'}`;
}
