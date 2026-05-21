import Link from 'next/link';

import { Card, CardBody, Stat } from '@/components/ui/card';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function monthlyPrice(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return '-';
  return money(cents / 100);
}

export default async function PlatformBillingPage() {
  const supabase = await createClient();
  const [{ data: portfolios }, { data: subscriptions }] = await Promise.all([
    (supabase as any).from('portfolios').select('id, company_name, suspended_at').is('archived_at', null),
    (supabase as any)
      .from('subscriptions')
      .select('id, portfolio_id, tier, status, billing_email, seats_used, seats_included, price_monthly_cents, trial_ends_at, current_period_end, cancel_at_period_end')
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  const portfolioById = new Map((portfolios ?? []).map((portfolio: any) => [portfolio.id, portfolio]));
  const trialing = (subscriptions ?? []).filter((subscription: any) => subscription.status === 'trialing').length;
  const active = (subscriptions ?? []).filter((subscription: any) => subscription.status === 'active').length;
  const monthlyCents = (subscriptions ?? []).reduce((sum: number, subscription: any) => sum + (subscription.price_monthly_cents ?? 0), 0);

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-2xl font-semibold text-gray-950">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">Subscription oversight. Stripe controls will be wired in the payment phase.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Active" value={active} sub="Paid subscriptions" />
        <Stat label="Trials" value={trialing} sub="Trial subscriptions" />
        <Stat label="Monthly list" value={monthlyPrice(monthlyCents)} sub="Configured monthly price" />
      </div>

      <Card>
        <CardBody className="p-0">
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Client</TH>
                <TH>Tier</TH>
                <TH>Status</TH>
                <TH>Seats</TH>
                <TH>Monthly</TH>
                <TH>Trial ends</TH>
                <TH>Period ends</TH>
              </TR>
            </THead>
            <tbody>
              {(subscriptions ?? []).length === 0 ? (
                <TR>
                  <TD colSpan={7} className="py-10 text-center text-gray-500">No subscription records are visible.</TD>
                </TR>
              ) : (
                (subscriptions ?? []).map((subscription: any) => {
                  const portfolio = portfolioById.get(subscription.portfolio_id) as any;
                  return (
                    <TR key={subscription.id} className="hover:bg-gray-50">
                      <TD>
                        <Link href={`/platform/portfolios/${subscription.portfolio_id}`} className="font-medium text-blue-700 hover:underline">
                          {portfolio?.company_name ?? 'Unknown client'}
                        </Link>
                        <div className="mt-1 text-xs text-gray-500">{subscription.billing_email ?? 'No billing email'}</div>
                      </TD>
                      <TD className="uppercase">{subscription.tier ?? '-'}</TD>
                      <TD>{subscription.cancel_at_period_end ? `${subscription.status} - canceling` : subscription.status}</TD>
                      <TD>{subscription.seats_used ?? 0} / {subscription.seats_included ?? '-'}</TD>
                      <TD>{monthlyPrice(subscription.price_monthly_cents)}</TD>
                      <TD>{date(subscription.trial_ends_at)}</TD>
                      <TD>{date(subscription.current_period_end)}</TD>
                    </TR>
                  );
                })
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
