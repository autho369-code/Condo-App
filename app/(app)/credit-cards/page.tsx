import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Alert, EmptyState, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireFinanceStaff } from '@/lib/auth/me';
import { saveCreditCardAccount } from '@/lib/rpcs/credit-cards';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CreditCardsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireFinanceStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);

  const [{ data: cards }, { data: monthCharges }, { data: associations }, { data: liabilityGls }] = await Promise.all([
    db.from('credit_card_accounts')
      .select('id, name, issuer, last_four, association_id, associations(name), gl_accounts(number, name)')
      .is('archived_at', null)
      .order('name'),
    db.from('credit_card_charges').select('card_id, amount').is('voided_at', null).gte('charge_date', monthStartIso),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('gl_accounts').select('id, number, name, association_id').eq('active', true)
      .in('account_type', ['liability', 'accounts_payable']).order('number'),
  ]);
  const monthByCard = new Map<string, number>();
  for (const c of (monthCharges ?? []) as any[]) monthByCard.set(c.card_id, (monthByCard.get(c.card_id) ?? 0) + Number(c.amount));
  const rows = (cards ?? []) as any[];
  const monthTotal = [...monthByCard.values()].reduce((s, v) => s + v, 0);
  const defaultGl = ((liabilityGls ?? []) as any[]).find((g) => /credit card/i.test(g.name) && !g.association_id)?.id ?? '';

  return (
    <DataWorkspace
      title="Credit card accounts"
      description="Association credit cards. Each purchase posts to the card's liability account; pay the card with a bill to the issuer coded to that account."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/reports/credit_card_expense_detail"><Button variant="secondary">Credit Card Expense Detail</Button></Link>
          <Link href="/bank-accounts"><Button variant="secondary">Bank accounts</Button></Link>
        </div>
      }
    >
      <div className="space-y-4">
        {sp.error && <Alert tone="danger" title="Could not save the card">{sp.error}</Alert>}
        <MetricStrip
          metrics={[
            { label: 'Cards', value: rows.length },
            { label: 'Charged this month', value: money(monthTotal) },
          ]}
        />

        {rows.length === 0 ? (
          <Surface padded={false}>
            <EmptyState icon={CreditCard} title="No credit card accounts yet" description="Add an association's card below, then record its purchases." />
          </Surface>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Card</TH>
                <TH>Association</TH>
                <TH>Liability account</TH>
                <TH className="text-right">Charged this month</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/credit-cards/${c.id}`} className="font-medium text-gray-950 hover:underline">{c.name}</Link>
                    <div className="text-xs text-gray-500">{[c.issuer, c.last_four ? `•••• ${c.last_four}` : null].filter(Boolean).join(' · ') || '—'}</div>
                  </TD>
                  <TD className="text-sm text-gray-700">{c.associations?.name ?? 'Any association'}</TD>
                  <TD className="text-sm text-gray-700">{c.gl_accounts ? `${c.gl_accounts.number} ${c.gl_accounts.name}` : '—'}</TD>
                  <TD className="text-right tabular-nums">{money(monthByCard.get(c.id) ?? 0)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}

        <Surface>
          <SectionTitle title="Add a credit card account" description="Only the last four digits are stored — never the full card number." />
          <form action={saveCreditCardAccount} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="name"><Input id="name" name="name" required placeholder="e.g. Granville Amex" /></Field>
            <Field label="Association" htmlFor="association_id" hint="Leave empty for a company card used across associations.">
              <Select id="association_id" name="association_id" defaultValue="">
                <option value="">Any association</option>
                {((associations ?? []) as any[]).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Issuer (optional)" htmlFor="issuer"><Input id="issuer" name="issuer" placeholder="e.g. American Express" /></Field>
            <Field label="Last four digits (optional)" htmlFor="last_four"><Input id="last_four" name="last_four" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" /></Field>
            <Field label="Liability account" htmlFor="gl_account_id" className="sm:col-span-2" hint="Where the card balance builds up, e.g. Credit Card Payable.">
              <Select id="gl_account_id" name="gl_account_id" required defaultValue={defaultGl}>
                <option value="">Choose an account</option>
                {((liabilityGls ?? []) as any[]).map((g) => <option key={g.id} value={g.id}>{g.number} · {g.name}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2"><Button type="submit">Add card</Button></div>
          </form>
        </Surface>
      </div>
    </DataWorkspace>
  );
}
