import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type UnitAccountSummary = {
  unit_id: string | null;
  unit_number: string | null;
  association_id: string | null;
  outstanding_balance?: number | string | null;
  unapplied_credit?: number | string | null;
};

type AssociationRemit = {
  id: string;
  name: string;
  remit_payee: string | null;
  remit_address: string | null;
  payment_instructions: string | null;
};

export default async function PayPage() {
  await requireAuth();
  const supabase = await createClient();

  // The resident's unit summary(ies). RLS filters to their own unit(s).
  const { data: units } = await (supabase as any)
    .from('v_unit_account_summary')
    .select('*')
    .order('association_id');

  const unitOptions = (units ?? []) as UnitAccountSummary[];
  const associationIds: string[] = Array.from(
    new Set(unitOptions.map((u) => u.association_id).filter((id): id is string => Boolean(id)))
  );

  const { data: associations } = associationIds.length
    ? await (supabase as any)
        .from('associations')
        .select('id, name, remit_payee, remit_address, payment_instructions')
        .in('id', associationIds)
    : { data: [] };
  const assocById = new Map<string, AssociationRemit>(
    ((associations ?? []) as AssociationRemit[]).map((a) => [a.id, a])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">How to pay</h1>
        <Link href="/portal"><Button variant="secondary">Back</Button></Link>
      </div>

      {!unitOptions.length && (
        <Card><CardBody>
          <p className="text-sm text-gray-500">We couldn&apos;t find a unit linked to your account. Please contact your management company.</p>
        </CardBody></Card>
      )}

      {unitOptions.map((unit) => {
        const assoc = unit.association_id ? assocById.get(unit.association_id) : undefined;
        const balance = Number(unit.outstanding_balance ?? 0);
        const credit = Number(unit.unapplied_credit ?? 0);
        const hasInstructions = !!(assoc?.remit_payee || assoc?.remit_address || assoc?.payment_instructions);
        return (
          <Card key={unit.unit_id ?? Math.random()}>
            <CardHeader>
              <CardTitle>{assoc?.name ?? 'Association'} — Unit {unit.unit_number ?? '—'}</CardTitle>
              <p className="text-sm text-gray-500">
                Current balance
                <span className={`ml-1 font-semibold tabular-nums ${balance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {money(unit.outstanding_balance ?? 0)}
                </span>
                {credit > 0 && <span className="ml-2 text-xs text-emerald-700">(plus {money(unit.unapplied_credit)} credit on file)</span>}
              </p>
            </CardHeader>
            <CardBody>
              {hasInstructions ? (
                <div className="space-y-4">
                  {assoc?.remit_payee && (
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Make checks payable to</div>
                      <div className="mt-0.5 text-sm font-medium text-gray-900">{assoc.remit_payee}</div>
                    </div>
                  )}
                  {assoc?.remit_address && (
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Mail payments to</div>
                      <div className="mt-0.5 whitespace-pre-line text-sm text-gray-900">{assoc.remit_address}</div>
                    </div>
                  )}
                  {assoc?.payment_instructions && (
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">Other options &amp; notes</div>
                      <div className="mt-0.5 whitespace-pre-line text-sm text-gray-700">{assoc.payment_instructions}</div>
                    </div>
                  )}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                    Please include <span className="font-medium text-gray-900">Unit {unit.unit_number ?? ''}</span> as the account/memo on your check or bill-pay so your payment is applied correctly.
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Payment instructions for this association haven&apos;t been set up yet. Please contact your management company for where to send your payment.
                </div>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <Link href="/portal/ledger"><Button variant="secondary" type="button">View ledger</Button></Link>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
