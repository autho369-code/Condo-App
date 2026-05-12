import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { applyCredits } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ApplyCreditsPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: credits }, { data: charges }] = await Promise.all([
    (supabase as any)
      .from('v_unapplied_credits')
      .select('payment_id, unit_id, amount, applied_amount, unapplied_amount, payment_date')
      .gt('unapplied_amount', 0)
      .order('payment_date', { ascending: false })
      .limit(100),
    (supabase as any)
      .from('aged_receivables')
      .select('charge_id, unit_id, unit_number, association_name, description, due_date, balance_due')
      .gt('balance_due', 0)
      .order('due_date')
      .limit(200),
  ]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-5xl">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Apply Credits</h1>
          <Link href="/charges" className="text-sm text-ink-600 hover:text-ink-900">Cancel</Link>
        </div>

        <form action={applyCredits} className="space-y-4 border border-ink-100 bg-white p-5">
          <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-ink-600">
            Credit Payment
            <select name="payment_id" required className="mt-1 h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm normal-case tracking-normal">
              <option value="">Select credit</option>
              {(credits ?? []).map((credit: any) => (
                <option key={credit.payment_id} value={credit.payment_id}>
                  {date(credit.payment_date)} - {money(credit.unapplied_amount)} unapplied
                </option>
              ))}
            </select>
          </label>

          <div className="overflow-x-auto border border-ink-100">
            <table className="w-full text-sm">
              <thead className="bg-ink-100 text-xs font-semibold text-ink-700">
                <tr>
                  <th className="w-10 px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-left">Association - Unit</th>
                  <th className="px-3 py-2 text-left">Charge</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(charges ?? []).map((charge: any) => (
                  <tr key={charge.charge_id} className="border-t border-ink-100">
                    <td className="px-3 py-2"><input type="checkbox" name="charge_ids" value={charge.charge_id} /></td>
                    <td className="px-3 py-2">{date(charge.due_date)}</td>
                    <td className="px-3 py-2">
                      <div>{charge.association_name ?? '-'}</div>
                      <div className="text-xs text-ink-500">{charge.unit_number ? `Unit ${charge.unit_number}` : ''}</div>
                    </td>
                    <td className="px-3 py-2">{charge.description}</td>
                    <td className="px-3 py-2 text-right font-medium">{money(charge.balance_due)}</td>
                  </tr>
                ))}
                {(charges ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-ink-500">No open charges found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Link href="/charges" className="rounded-md border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700">Cancel</Link>
            <Button type="submit" disabled={(credits ?? []).length === 0}>Apply Credit</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
