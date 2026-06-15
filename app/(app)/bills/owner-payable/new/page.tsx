import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Breadcrumb, PageHeader, PageShell, SectionTitle, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { createOwnerPayable } from '@/lib/rpcs/owner-payables';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function NewOwnerPayablePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; error?: string }>;
}) {
  const me = await requireStaff();
  const supabase = await createClient();
  const sp = await searchParams;
  const { type: defaultType } = sp;

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
    <PageShell className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Owner payables', href: '/bills/owner-payable' }, { label: 'New owner payable' }]} />
      <PageHeader
        title="New owner payable"
        actions={<Link href="/bills/owner-payable"><Button variant="secondary">Cancel</Button></Link>}
      />

      {sp.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Could not save owner payable:</span> {sp.error}
        </div>
      )}

      <Surface>
        <SectionTitle title="Owner payable details" />
        <form action={createOwnerPayable as any} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input type="hidden" name="portfolio_id" value={me.portfolio?.id ?? ''} />

              {/* OWNER */}
              <div className="sm:col-span-2">
                <Label htmlFor="owner_id">Owner *</Label>
                <Select id="owner_id" name="owner_id" required>
                  <option value="">Select an owner…</option>
                  {(owners ?? []).map((o: any) => (
                    <option key={o.id} value={o.id}>{o.full_name} — {o.email}</option>
                  ))}
                </Select>
              </div>

              {/* ASSOCIATION */}
              <div>
                <Label htmlFor="association_id">Association *</Label>
                <Select id="association_id" name="association_id" required>
                  <option value="">Select an association…</option>
                  {(associations ?? []).map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </div>

              {/* PAYABLE TYPE */}
              <div>
                <Label htmlFor="payable_type">Payable type *</Label>
                <Select id="payable_type" name="payable_type" defaultValue={defaultType ?? 'refund'}>
                  <option value="refund">Refund</option>
                  <option value="settlement">Settlement</option>
                  <option value="distribution">Distribution</option>
                  <option value="other">Other</option>
                </Select>
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
                <Select id="gl_account_id" name="gl_account_id">
                  <option value="">—</option>
                  {(gls ?? []).map((g: any) => (
                    <option key={g.id} value={g.id}>{g.number} — {g.name}</option>
                  ))}
                </Select>
              </div>

              {/* BANK ACCOUNT */}
              <div>
                <Label htmlFor="bank_account_id">Pay from bank account</Label>
                <Select id="bank_account_id" name="bank_account_id">
                  <option value="">—</option>
                  {(banks ?? []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name} {b.bank_name ? `(${b.bank_name})` : ''}</option>
                  ))}
                </Select>
              </div>

              {/* MEMO */}
              <div className="sm:col-span-2">
                <Label htmlFor="memo">Memo</Label>
                <Textarea id="memo" name="memo" rows={2}
                  placeholder="e.g. Refund for overpaid December 2026 assessment" />
              </div>

              {/* STATUS */}
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue="pending_approval">
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending approval</option>
                  <option value="approved">Approved</option>
                </Select>
              </div>

              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit">Save owner payable</Button>
                <Link href="/bills/owner-payable"><Button variant="secondary" type="button">Cancel</Button></Link>
              </div>
            </form>
      </Surface>
    </PageShell>
  );
}
