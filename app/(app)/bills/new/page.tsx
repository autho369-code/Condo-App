import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createBill } from '@/lib/rpcs/bills';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function NewBillPage() {
  const me = await requireStaff();
  const supabase = await createClient();

  // All the dropdown sources are filtered by RLS to the user's portfolio
  const [{ data: vendors }, { data: associations }, { data: gls }, { data: banks }] = await Promise.all([
    supabase.from('vendors')
      .select('id, name, trade, payment_type')
      .is('archived_at', null)
      .order('name'),
    supabase.from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
    supabase.from('gl_accounts')
      .select('id, number, name, account_type')
      .eq('active', true)
      .in('account_type', ['expense','cost_of_goods_sold','other_expense'])
      .order('number'),
    supabase.from('bank_accounts')
      .select('id, name, bank_name')
      .is('archived_at', null)
      .order('name'),
  ]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-gray-200 bg-white px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              <Link href="/bills" className="hover:text-brand-600">Accounts payable</Link>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-gray-900">New bill</h1>
          </div>
          <Link href="/bills"><Button variant="secondary" size="sm">Cancel</Button></Link>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50 px-8 py-6">

      <Card>
        <CardHeader><CardTitle>Bill details</CardTitle></CardHeader>
        <CardBody>
          <form action={createBill} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input type="hidden" name="portfolio_id" value={me.portfolio?.id ?? ''} />

            {/* VENDOR */}
            <div className="md:col-span-2">
              <Label htmlFor="vendor_id">Vendor *</Label>
              <select id="vendor_id" name="vendor_id" required
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">Select a vendor…</option>
                {(vendors ?? []).map((v: any) => (
                  <option key={v.id} value={v.id}>{v.name} — {v.trade} ({v.payment_type})</option>
                ))}
              </select>
            </div>

            {/* ASSOCIATION */}
            <div>
              <Label htmlFor="association_id">Association</Label>
              <select id="association_id" name="association_id"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">— None (portfolio-wide) —</option>
                {(associations ?? []).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">The HOA the bill is billed to.</p>
            </div>

            {/* AMOUNT */}
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                <Input id="amount" name="amount" type="number" step="0.01" min="0" required className="pl-6" />
              </div>
            </div>

            {/* BILL NUMBER / REFERENCE */}
            <div>
              <Label htmlFor="bill_number">Invoice / reference #</Label>
              <Input id="bill_number" name="bill_number" placeholder="e.g. INV-4521" />
            </div>

            {/* DATES */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="bill_date">Bill date *</Label>
                <Input id="bill_date" name="bill_date" type="date" required defaultValue={new Date().toISOString().slice(0,10)} />
              </div>
              <div>
                <Label htmlFor="due_date">Due date</Label>
                <Input id="due_date" name="due_date" type="date" />
              </div>
            </div>

            {/* GL ACCOUNT */}
            <div>
              <Label htmlFor="gl_account_id">Expense GL account</Label>
              <select id="gl_account_id" name="gl_account_id"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">—</option>
                {(gls ?? []).map((g: any) => (
                  <option key={g.id} value={g.id}>{g.number} — {g.name}</option>
                ))}
              </select>
            </div>

            {/* BANK */}
            <div>
              <Label htmlFor="bank_account_id">Pay from bank account</Label>
              <select id="bank_account_id" name="bank_account_id"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">—</option>
                {(banks ?? []).map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name} {b.bank_name ? `(${b.bank_name})` : ''}</option>
                ))}
              </select>
            </div>

            {/* MEMO — prints on the check */}
            <div className="md:col-span-2">
              <Label htmlFor="memo">Memo (prints on check) *</Label>
              <textarea id="memo" name="memo" rows={2}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                placeholder="e.g. Dec 2026 gas utility — Granville Tower" />
              <p className="mt-1 text-xs text-gray-500">This shows on the printed check&apos;s memo line and on the check stub.</p>
            </div>

            {/* STATUS + APPROVAL */}
            <div>
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" defaultValue="pending_approval"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="draft">Draft</option>
                <option value="pending_approval">Pending approval</option>
                <option value="approved">Approved</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="approval_required" defaultChecked /> Requires board approval
              </label>
            </div>

            <div className="md:col-span-2 flex justify-end gap-2">
              <Link href="/bills"><Button variant="secondary" type="button">Cancel</Button></Link>
              <Button type="submit">Save bill</Button>
            </div>
          </form>
        </CardBody>
      </Card>
      </div>
    </div>
  );
}
