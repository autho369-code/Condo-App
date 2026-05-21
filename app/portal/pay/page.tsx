import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createOwnerCheckoutSession } from '@/lib/rpcs/checkout';
import { isStripePaymentsConfigured } from '@/lib/payments/config';
import { money } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PayPage() {
  const me = await requireAuth();
  const supabase = await createClient();
  const paymentsEnabled = isStripePaymentsConfigured();

  // The resident's unit summary(ies). RLS filters to their own unit(s).
  const { data: units } = await (supabase as any)
    .from('v_unit_account_summary')
    .select('*')
    .order('association_name');

  // Pick the first one with a balance as the default
  const defaultUnit =
    (units ?? []).find((u: any) => Number(u.outstanding_balance) > 0) ??
    (units ?? [])[0];

  const defaultAmount = Math.max(0, Number(defaultUnit?.outstanding_balance ?? 0));

  const portfolioPolicy = {
    label:       me.portfolio?.convenience_fee_label ?? 'Processing fee',
    cardPct:     Number(me.portfolio?.convenience_fee_card_pct ?? 2.9),
    mode:        me.portfolio?.convenience_fee_mode ?? 'pass_through',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pay assessment</h1>
        <Link href="/portal"><Button variant="secondary">Back</Button></Link>
      </div>

      {!units?.length && (
        <Card><CardBody>
          <p className="text-sm text-gray-500">We couldn&apos;t find a unit linked to your account. Ask your management company to finish the portal setup.</p>
        </CardBody></Card>
      )}

      {defaultUnit && (
        <Card>
          <CardHeader>
            <CardTitle>{defaultUnit.association_name} · Unit {defaultUnit.unit_number}</CardTitle>
            <p className="text-sm text-gray-500">Your current balance is
              <span className={`ml-1 font-semibold ${Number(defaultUnit.outstanding_balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {money(defaultUnit.outstanding_balance)}
              </span>
              {Number(defaultUnit.unapplied_credit) > 0 &&
                <span className="ml-2 text-xs text-green-600">(plus {money(defaultUnit.unapplied_credit)} credit on file)</span>}
            </p>
          </CardHeader>
          <CardBody>
            {!paymentsEnabled ? (
              <div className="space-y-5">
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-semibold text-amber-950">Online payments coming soon</div>
                  <p className="mt-1 text-sm text-amber-900">
                    Stripe checkout is being configured for {me.portfolio?.company_name ?? 'this portal'}.
                    For now, please use your current payment instructions or contact management before submitting a payment.
                  </p>
                </div>

                <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  <div className="font-medium text-gray-900">Balance shown for reference</div>
                  <p className="mt-1">
                    Your portal balance remains visible here, and online ACH/card options will appear once the processor is enabled.
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Link href="/portal"><Button variant="secondary" type="button">Back to portal</Button></Link>
                  <Link href="/portal/ledger"><Button type="button">View ledger</Button></Link>
                </div>
              </div>
            ) : (
            <form action={createOwnerCheckoutSession as any} className="space-y-5">
              <input type="hidden" name="unit_id" value={defaultUnit.unit_id} />

              {/* Amount */}
              <div>
                <Label htmlFor="amount">Amount to pay</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                  <Input id="amount" name="amount" type="number" step="0.01" min="1"
                         defaultValue={defaultAmount.toFixed(2)} className="pl-6" required />
                </div>
                <p className="mt-1 text-xs text-gray-500">Enter any amount. The system will apply it to your oldest open charges first.</p>
              </div>

              {/* Payment method */}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-gray-700">Payment method</legend>

                <label className="flex items-start gap-3 rounded-md border border-gray-300 p-3 cursor-pointer hover:bg-gray-50 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                  <input type="radio" name="method" value="ach" defaultChecked className="mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">Bank account (ACH / eCheck)</div>
                    <div className="text-xs text-gray-500">
                      {portfolioPolicy.mode === 'pass_through'
                        ? 'No fee. Funds settle in 3–5 business days.'
                        : 'Funds settle in 3–5 business days.'}
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-md border border-gray-300 p-3 cursor-pointer hover:bg-gray-50 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                  <input type="radio" name="method" value="card" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium">Debit or credit card</div>
                    <div className="text-xs text-gray-500">
                      {portfolioPolicy.mode === 'pass_through'
                        ? `A ${portfolioPolicy.cardPct}% convenience fee is added at checkout. Posts immediately.`
                        : 'Posts immediately. No fee.'}
                    </div>
                  </div>
                </label>
              </fieldset>

              {/* Fee notice */}
              {portfolioPolicy.mode === 'pass_through' && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                  Card payments include a <strong>{portfolioPolicy.cardPct}% {portfolioPolicy.label}</strong>.
                  ACH payments have no fee.
                </div>
              )}

              {/* Unit selector if they own multiple units */}
              {(units ?? []).length > 1 && (
                <div>
                  <Label htmlFor="unit_id_picker">Unit</Label>
                  <select id="unit_id_picker" name="unit_id" defaultValue={defaultUnit.unit_id}
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                    {units!.map((u: any) => (
                      <option key={u.unit_id} value={u.unit_id}>
                        {u.association_name} · Unit {u.unit_number} (balance {money(u.outstanding_balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Link href="/portal"><Button variant="secondary" type="button">Cancel</Button></Link>
                <Button type="submit" size="lg">Continue to secure checkout</Button>
              </div>

              <p className="text-center text-xs text-gray-500">
                Powered by Stripe. Your payment info never touches our servers.
              </p>
            </form>
            )}
          </CardBody>
        </Card>
      )}

      <Link href="/portal/autopay">
        <Card className="cursor-pointer transition hover:border-brand-500">
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Set up autopay</div>
                <div className="text-sm text-gray-500">Pay dues automatically via ACH each month. No more late fees.</div>
              </div>
              <span className="text-brand-600">→</span>
            </div>
          </CardBody>
        </Card>
      </Link>
    </div>
  );
}
