import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createOwnerPayable } from '@/lib/rpcs/owner-payables';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function NewOwnerPayablePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const me = await requireStaff();
  const supabase = await createClient();
  const { type: defaultType } = await searchParams;

  const [{ data: owners }, { data: associations }, { data: gls }, { data: banks }] = await Promise.all([
    (supabase as any).from('owners')
      .select('id, full_name, email')
      .order('full_name'),
    (supabase as any).from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
    (supabase as any).from('gl_accounts')
      .select('id, number, name, account_type')
      .eq('active', true)
      .order('number'),
    (supabase as any).from('bank_accounts')
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
              <Link href="/bills/owner-payable" className="hover:text-brand-600">Owner payables</Link>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-gray-900">New owner payable</h1>
          </div>
          <Link href="/bills/owner-payable"><Button variant="secondary" size="sm">Cancel</Button></Link>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50 px-8 py-6">
        <Card>
          <CardHeader><CardTitle>Owner payable details</CardTitle></CardHeader>
          <CardBody>
            <form action={createOwnerPayable as any} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input type="hidden" name="portfolio_id" value={me.portfolio?.id ?? ''} />

              {/* OWNER */}
              <div className="md:col-span-2">
                <Label htmlFor="owner_id">Owner *</Label>
                <select id="owner_id" name="owner_id" required
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                  <option value="">Select an owner…</option>
                  {(owners ?? []).map((o: any) => (
                    <option key={o.id} value={o.id}>{o.full_name} — {o.email}</option>
                  ))}
                </select>
              </div>

              {/* ASSOCIATION */}
              <div>
                <Label htmlFor="association_id">Association *</Label>
                <select id="association_id" name="association_id" required
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                  <option value="">Select an association…</option>
                  {(associations ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* PAYABLE TYPE */}
              <div>
                <Label htmlFor="payable_type">Payable type *</Label>
                <select id="payable_type" name="payable_type" defaultValue={defaultType ?? 'refund'}
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                  <option value="refund">Refund</option>
                  <option value="settlement">Settlement</option>
                  <option value="distribution">Distribution</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* AMOUNT */}
              <div>
                <Label htmlFor="amount">Amount *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">$</span>
                  <Input id="amount" name="amount" type="number" step="0.01" min="0" required className="pl-6" />
                </div>
              </div>

              {/* DATES */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="payable_date">Payable date *</Label>
                  <Input id="payable_date" name="payable_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div>
                  <Label htmlFor="due_date">Due date</Label>
                  <Input id="due_date" name="due_date" type="date" />
                </div>
              </div>

              {/* GL ACCOUNT */}
              <div>
                <Label htmlFor="gl_account_id">GL account</Label>
                <select id="gl_account_id" name="gl_account_id"
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                  <option value="">—</option>
                  {(gls ?? []).map((g: any) => (
                    <option key={g.id} value={g.id}>{g.number} — {g.name}</option>
                  ))}
                </select>
              </div>

              {/* BANK ACCOUNT */}
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

              {/* MEMO */}
              <div className="md:col-span-2">
                <Label htmlFor="memo">Memo</Label>
                <textarea id="memo" name="memo" rows={2}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="e.g. Refund for overpaid December 2026 assessment" />
              </div>

              {/* STATUS */}
              <div>
                <Label htmlFor="status">Status</Label>
                <select id="status" name="status" defaultValue="pending_approval"
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending approval</option>
                  <option value="approved">Approved</option>
                </select>
              </div>

              <div className="md:col-span-2 flex justify-end gap-2">
                <Link href="/bills/owner-payable"><Button variant="secondary" type="button">Cancel</Button></Link>
                <Button type="submit">Save owner payable</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
