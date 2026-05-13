import { AccountingPage, AccountingSearchBox } from '@/components/accounting/accounting-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ChargesPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('payments')
    .select(`
      id,
      amount,
      payment_date,
      method,
      reference,
      notes,
      gl_accounts(number, name),
      units(unit_number, buildings(name, associations(name)))
    `)
    .order('payment_date', { ascending: false })
    .limit(100);

  return (
    <AccountingPage
      active="receivables"
      title="Receipts"
      subtabs={[
        { label: 'Receipts', href: '/charges', active: true },
        { label: 'Charges', href: '/charges?view=charges' },
        { label: 'New Bank Deposit', href: '/bank-accounts/deposits/new' },
        { label: 'Owner Delinquencies', href: '/reports?slug=owner-delinquency' },
      ]}
    >
      <div className="space-y-4">
        <AccountingSearchBox>Click here to search</AccountingSearchBox>

        {rows && rows.length > 0 ? (
          <Table>
            <THead>
              <TR><TH>Date</TH><TH>Payer</TH><TH>GL Account</TH><TH>Association - Unit</TH><TH className="text-right">Amount</TH><TH>Reference</TH></TR>
            </THead>
            <tbody>
              {rows.map((payment: any) => {
                const unit = payment.units;
                const building = unit?.buildings;
                const association = building?.associations;
                return (
                  <TR key={payment.id}>
                    <TD className="whitespace-nowrap text-sm">{date(payment.payment_date)}</TD>
                    <TD>{payment.notes || payment.method || 'Payment'}</TD>
                    <TD>{payment.gl_accounts ? `${payment.gl_accounts.number}: ${payment.gl_accounts.name}` : '-'}</TD>
                    <TD>
                      <div>{association?.name ?? building?.name ?? '-'}</div>
                      <div className="text-xs text-ink-500">{unit?.unit_number ? `Unit ${unit.unit_number}` : ''}</div>
                    </TD>
                    <TD className="text-right font-medium text-brand-700">{money(payment.amount)}</TD>
                    <TD className="font-mono text-xs text-ink-600">{payment.reference ?? '-'}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <p className="border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">No receipts found.</p>
        )}
      </div>
    </AccountingPage>
  );
}
