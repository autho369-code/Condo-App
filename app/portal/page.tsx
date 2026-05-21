import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody, Stat } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/utils';
import { isStripePaymentsConfigured } from '@/lib/payments/config';

export const dynamic = 'force-dynamic';

export default async function PortalHome() {
  const me = await requireAuth();
  const supabase = await createClient();

  // The resident's own unit summary (RLS filters to their unit only)
  const { data: units } = await (supabase as any).from('v_unit_account_summary').select('*');

  const total = (units ?? []).reduce((acc: any, u: any) => ({
    outstanding: (acc.outstanding ?? 0) + Number(u.outstanding_balance ?? 0),
    credit:      (acc.credit ?? 0)      + Number(u.unapplied_credit ?? 0),
  }), {});
  const paymentsEnabled = isStripePaymentsConfigured();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Welcome{me.profile?.full_name ? `, ${me.profile.full_name.split(' ')[0]}` : ''}</h1>
        <p className="text-sm text-gray-500">Your account overview</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Current balance"
          value={<span className={Number(total.outstanding) > 0 ? 'text-red-600' : 'text-green-600'}>{money(total.outstanding)}</span>} />
        <Stat label="Credit on file" value={<span className="text-green-600">{money(total.credit)}</span>} />
      </div>

      <Card>
        <CardHeader><CardTitle>Your units</CardTitle></CardHeader>
        <CardBody>
          <ul className="space-y-3">
            {(units ?? []).map((u: any) => (
              <li key={u.unit_id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{u.association_name} · Unit {u.unit_number}</div>
                  <div className="text-xs text-gray-500">Charged {money(u.total_charged)} · Paid {money(u.total_paid)}</div>
                </div>
                <div className="text-right">
                  <div className={`font-medium ${Number(u.outstanding_balance) > 0 ? 'text-red-600' : ''}`}>{money(u.outstanding_balance)}</div>
                  {Number(u.unapplied_credit) > 0 && <div className="text-xs text-green-600">credit {money(u.unapplied_credit)}</div>}
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {Number(total.outstanding) > 0 && (
        <div className="flex gap-3">
          <Link href="/portal/pay">
            <Button size="lg" variant={paymentsEnabled ? 'primary' : 'secondary'}>
              {paymentsEnabled ? `Pay ${money(total.outstanding)}` : 'Payment setup pending'}
            </Button>
          </Link>
          <Link href="/portal/ledger"><Button size="lg" variant="secondary">View ledger</Button></Link>
        </div>
      )}
    </div>
  );
}
