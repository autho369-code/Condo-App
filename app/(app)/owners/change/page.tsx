import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';
import { changeHomeowner } from './actions';

export const dynamic = 'force-dynamic';

const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

export default async function ChangeHomeownerPage({ searchParams }: { searchParams: Promise<{ unit?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [unitsRes, ownersRes, occupanciesRes] = await Promise.all([
    fetchAllRows<any>(() => db.from('units')
      .select('id, unit_number, buildings!inner(associations!inner(name, archived_at))')
      .is('archived_at', null).is('buildings.associations.archived_at', null)
      .order('unit_number').order('id')),
    fetchAllRows<any>(() => db.from('owners').select('id, full_name, first_name, last_name, email')
      .is('archived_at', null).order('last_name').order('id')),
    fetchAllRows<any>(() => db.from('occupancies').select('unit_id, owners(full_name)')
      .eq('status', 'current').eq('occupancy_type', 'owner').order('id')),
  ]);

  const currentOwners = new Map<string, string[]>();
  for (const o of occupanciesRes.rows) {
    const list = currentOwners.get(o.unit_id) ?? [];
    if (o.owners?.full_name) list.push(o.owners.full_name);
    currentOwners.set(o.unit_id, list);
  }
  const units = [...unitsRes.rows].sort((a, b) =>
    `${a.buildings?.associations?.name ?? ''} ${a.unit_number ?? ''}`.localeCompare(`${b.buildings?.associations?.name ?? ''} ${b.unit_number ?? ''}`, undefined, { numeric: true }));
  const ownerName = (o: any) => (o.last_name && o.first_name ? `${o.last_name}, ${o.first_name}` : o.full_name ?? 'Unnamed owner');
  const loadError = unitsRes.error ?? ownersRes.error ?? occupanciesRes.error;

  return (
    <DataWorkspace
      title="Change Homeowner"
      description="Record a unit sale: the new owner takes over the unit and the previous owner's ownership ends on the transfer date. The unit's balance stays with the unit."
      actions={<Link href="/owners"><Button variant="secondary">Back to homeowners</Button></Link>}
    >
      <form action={changeHomeowner} className="max-w-3xl space-y-6 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not change the homeowner">{sp.error}</Alert>}
        {loadError && <Alert tone="danger" title="Could not load every unit or owner">{loadError}</Alert>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="unit_id">Unit <span className="text-red-500">*</span></Label>
            <select id="unit_id" name="unit_id" required defaultValue={sp.unit ?? ''} className={inputCls}>
              <option value="">Select unit</option>
              {units.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.buildings?.associations?.name ?? '—'} · Unit {u.unit_number}
                  {currentOwners.get(u.id)?.length ? ` — current: ${currentOwners.get(u.id)!.join(', ')}` : ' — no current owner'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="transfer_date">Transfer date <span className="text-red-500">*</span></Label>
            <Input id="transfer_date" name="transfer_date" type="date" required defaultValue={todayInZone()} />
          </div>
        </div>

        <section className="border-t border-gray-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">New owner</div>
          <div>
            <Label htmlFor="existing_owner_id">Existing owner record</Label>
            <select id="existing_owner_id" name="existing_owner_id" defaultValue="" className={inputCls}>
              <option value="">Not on file — enter below</option>
              {ownersRes.rows.map((o: any) => (
                <option key={o.id} value={o.id}>{ownerName(o)}{o.email ? ` (${o.email})` : ''}</option>
              ))}
            </select>
          </div>
          <p className="mt-3 text-xs text-gray-500">Or enter a new owner (used only when no existing record is selected):</p>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="first_name">First name</Label>
              <Input id="first_name" name="first_name" />
            </div>
            <div>
              <Label htmlFor="last_name">Last name</Label>
              <Input id="last_name" name="last_name" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/owners" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Change homeowner</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
