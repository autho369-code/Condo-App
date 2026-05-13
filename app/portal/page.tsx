import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardSubtitle, CardBody, Stat } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/utils';
import { isStripePaymentsConfigured } from '@/lib/payments/config';

export const dynamic = 'force-dynamic';

export default async function PortalHome() {
  const me = await requireAuth();
  const supabase = await createClient();
  const unitIds = me.resident_unit_ids ?? [];

  const { data: units } = unitIds.length > 0
    ? await (supabase as any)
        .from('v_unit_account_summary')
        .select('*')
        .in('unit_id', unitIds)
    : { data: [] };

  const total = (units ?? []).reduce(
    (acc: any, u: any) => ({
      outstanding: (acc.outstanding ?? 0) + Number(u.outstanding_balance ?? 0),
      credit:      (acc.credit ?? 0)      + Number(u.unapplied_credit ?? 0),
    }),
    {},
  );
  const paymentsEnabled = isStripePaymentsConfigured();
  const owesMoney = Number(total.outstanding) > 0;

  return (
    <div className="space-y-10">
      {/* Editorial greeting */}
      <header className="border-b border-ink-100 pb-8">
        <div className="eyebrow">Resident overview</div>
        <h1 className="mt-3 font-display text-4xl tracking-editorial text-ink-900">
          Good day{me.profile?.full_name ? `, ${me.profile.full_name.split(' ')[0]}` : ''}.
        </h1>
        <p className="mt-2 max-w-xl text-[15px] text-ink-500">
          A summary of your account at {me.portfolio?.company_name ?? me.portfolio?.name ?? 'your community'}.
        </p>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Stat
          label="Current balance"
          value={
            <span className={owesMoney ? 'text-bordeaux-700' : 'text-sage-700'}>
              {money(total.outstanding)}
            </span>
          }
          sub={owesMoney ? 'Due upon receipt of statement' : 'Account in good standing'}
          accent={owesMoney}
        />
        <Stat
          label="Credit on file"
          value={<span className="text-sage-700">{money(total.credit)}</span>}
          sub="Will apply automatically to next charge"
        />
      </div>

      {/* Units */}
      <Card>
        <CardHeader>
          <CardTitle>Your residences</CardTitle>
          <CardSubtitle>Charges, payments, and outstanding balance — by unit.</CardSubtitle>
        </CardHeader>
        <CardBody className="px-0 py-0">
          <ul className="divide-y divide-ink-100">
            {(units ?? []).map((u: any) => (
              <li key={u.unit_id} className="flex items-center justify-between gap-4 px-5 py-5">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base text-ink-900 tracking-editorial">
                    {u.association_name} · Unit {u.unit_number}
                  </div>
                  <div className="mt-1 text-xs text-ink-500">
                    Charged <span className="tabular-nums">{money(u.total_charged)}</span> · Paid{' '}
                    <span className="tabular-nums">{money(u.total_paid)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-display text-xl number-plate ${
                      Number(u.outstanding_balance) > 0 ? 'text-bordeaux-700' : 'text-ink-900'
                    }`}
                  >
                    {money(u.outstanding_balance)}
                  </div>
                  {Number(u.unapplied_credit) > 0 && (
                    <div className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-sage-700">
                      Credit {money(u.unapplied_credit)}
                    </div>
                  )}
                </div>
              </li>
            ))}
            {(units ?? []).length === 0 && (
              <li className="px-5 py-10 text-center text-sm text-ink-500">
                No units linked to this account yet.
              </li>
            )}
          </ul>
        </CardBody>
      </Card>

      {/* CTA */}
      {owesMoney && (
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/portal/pay">
            <Button size="lg" variant={paymentsEnabled ? 'accent' : 'secondary'}>
              {paymentsEnabled ? `Settle ${money(total.outstanding)}` : 'Payment setup pending'}
            </Button>
          </Link>
          <Link href="/portal/ledger">
            <Button size="lg" variant="outline">View full ledger</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
