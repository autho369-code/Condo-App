import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createBankDeposit } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function NewBankDepositPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: accounts }, { data: payments }] = await Promise.all([
    (supabase as any).from('bank_accounts').select('id, name, bank_name').is('archived_at', null).order('name'),
    (supabase as any)
      .from('payments')
      .select('id, amount, payment_date, method, reference, notes, units(unit_number, buildings(name, associations(name)))')
      .is('bank_account_id', null)
      .order('payment_date', { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">New Bank Deposit</h1>
          <Link href="/bank-accounts" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>

        <form action={createBankDeposit} className="space-y-4 border border-ink-100 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-600">
              Bank Account
              <select name="bank_account_id" required className="mt-1 h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm normal-case tracking-normal">
                <option value="">Select account</option>
                {(accounts ?? []).map((account: any) => (
                  <option key={account.id} value={account.id}>{account.name}{account.bank_name ? ` - ${account.bank_name}` : ''}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-600">
              Deposit Date
              <input name="deposit_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="mt-1 h-10 w-full rounded-md border border-ink-200 px-3 text-sm normal-case tracking-normal" />
            </label>
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-600">
              Deposit Reference
              <input name="deposit_reference" className="mt-1 h-10 w-full rounded-md border border-ink-200 px-3 text-sm normal-case tracking-normal" />
            </label>
          </div>

          <div className="overflow-x-auto border border-ink-100">
            <table className="w-full text-sm">
              <thead className="bg-ink-100 text-xs font-semibold text-ink-700">
                <tr>
                  <th className="w-10 px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Association - Unit</th>
                  <th className="px-3 py-2 text-left">Method</th>
                  <th className="px-3 py-2 text-left">Reference</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(payments ?? []).map((payment: any) => (
                  <tr key={payment.id} className="border-t border-ink-100">
                    <td className="px-3 py-2"><input type="checkbox" name="payment_ids" value={payment.id} /></td>
                    <td className="px-3 py-2">{date(payment.payment_date)}</td>
                    <td className="px-3 py-2">
                      <div>{payment.units?.buildings?.associations?.name ?? payment.units?.buildings?.name ?? '-'}</div>
                      <div className="text-xs text-ink-500">{payment.units?.unit_number ? `Unit ${payment.units.unit_number}` : ''}</div>
                    </td>
                    <td className="px-3 py-2 capitalize">{payment.method}</td>
                    <td className="px-3 py-2 font-mono text-xs">{payment.reference ?? '-'}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(payment.amount)}</td>
                  </tr>
                ))}
                {(payments ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-ink-500">No undeposited receipts found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/bank-accounts" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
            <Button type="submit" disabled={(payments ?? []).length === 0}>Save Deposit</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
