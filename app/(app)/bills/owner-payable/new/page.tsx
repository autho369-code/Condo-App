import { createClient } from '@/lib/supabase/server';
import { requireFinanceStaff } from '@/lib/auth/me';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { Alert, Breadcrumb, PageHeader, PageShell, SectionTitle, Surface } from '@/components/ui/shell';
import { Button } from '@/components/ui/button';
import { createOwnerPayable } from '@/lib/rpcs/owner-payables';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function NewOwnerPayablePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; error?: string }>;
}) {
  await requireFinanceStaff();
  const supabase = await createClient();
  const sp = await searchParams;
  const { type: defaultType } = sp;

  // Homeowners with the association of each unit they own, so the payable can
  // be matched to one of their associations. All rows, past the 1,000 cap.
  const [{ rows: ownerships }, { rows: associations }, { rows: gls }, { rows: banks }] = await Promise.all([
    fetchAllRows<any>(() => (supabase as any).from('unit_owners')
      .select('id, owner_id, owners!inner(full_name, email, archived_at), units!inner(unit_number, buildings!inner(association_id, associations!inner(name)))')
      .is('owners.archived_at', null)
      .order('id')),
    fetchAllRows<any>(() => (supabase as any).from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name').order('id')),
    fetchAllRows<any>(() => (supabase as any).from('gl_accounts')
      .select('id, number, name, account_type')
      .eq('active', true)
      .order('number').order('id')),
    fetchAllRows<any>(() => (supabase as any).from('bank_accounts')
      .select('id, name, bank_name')
      .is('archived_at', null)
      .order('name').order('id')),
  ]);
  const ownerOptions = new Map<string, { id: string; label: string }>();
  for (const r of ownerships) {
    const assocName = r.units?.buildings?.associations?.name ?? '';
    const key = `${r.owner_id}`;
    const prev = ownerOptions.get(key);
    const label = `${r.owners?.full_name ?? 'Homeowner'} — ${assocName} ${r.units?.unit_number ?? ''}`.trim();
    ownerOptions.set(key, { id: r.owner_id, label: prev ? `${prev.label}; ${assocName} ${r.units?.unit_number ?? ''}`.trim() : label });
  }
  const owners = [...ownerOptions.values()].sort((x, y) => x.label.localeCompare(y.label));

  return (
    <PageShell className="max-w-4xl">
      <Breadcrumb items={[{ label: 'Homeowner payables', href: '/bills/owner-payable' }, { label: 'New homeowner payable' }]} />
      <PageHeader
        title="New homeowner payable"
        actions={<Link href="/bills/owner-payable"><Button variant="secondary">Cancel</Button></Link>}
      />

      {sp.error && <Alert tone="danger" title="Could not save homeowner payable" className="mb-6">{sp.error}</Alert>}

      <Surface>
        <SectionTitle title="Homeowner payable details" />
        <form action={createOwnerPayable} className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* OWNER */}
              <div className="sm:col-span-2">
                <Label htmlFor="owner_id">Homeowner *</Label>
                <Select id="owner_id" name="owner_id" required>
                  <option value="">Select a homeowner…</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </Select>
              </div>

              {/* ASSOCIATION */}
              <div>
                <Label htmlFor="association_id">Association *</Label>
                <Select id="association_id" name="association_id" required>
                  <option value="">Select an association…</option>
                  {associations.map((a: any) => (
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
                  <Input id="payable_date" name="payable_date" type="date" required defaultValue={todayInZone()} />
                </div>
                <div>
                  <Label htmlFor="due_date">Due date</Label>
                  <Input id="due_date" name="due_date" type="date" />
                </div>
              </div>

              {/* GL ACCOUNT */}
              <div>
                <Label htmlFor="gl_account_id">GL account *</Label>
                <Select id="gl_account_id" name="gl_account_id" required>
                  <option value="">Select the account to charge…</option>
                  {gls.map((g: any) => (
                    <option key={g.id} value={g.id}>{g.number} — {g.name}</option>
                  ))}
                </Select>
              </div>

              {/* BANK ACCOUNT */}
              <div>
                <Label htmlFor="bank_account_id">Pay from bank account</Label>
                <Select id="bank_account_id" name="bank_account_id">
                  <option value="">—</option>
                  {banks.map((b: any) => (
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

              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit">Save homeowner payable</Button>
                <Link href="/bills/owner-payable"><Button variant="secondary" type="button">Cancel</Button></Link>
              </div>
            </form>
      </Surface>
    </PageShell>
  );
}
