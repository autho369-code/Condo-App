import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { ownerWorkflowCards } from '@/lib/people/owner-workflows';
import { createOwner } from '@/lib/rpcs/entities';

export const dynamic = 'force-dynamic';

export default async function NewOwnerPage() {
  await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;
  const [{ data: associations }, { data: units }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('units').select('id, unit_number, buildings!inner(association_id)').is('archived_at', null).order('unit_number'),
  ]);

  return (
    <DataWorkspace
      title="New Owner"
      description="Create the owner profile with association and unit assignment, portal activation, and ownership details."
      actions={<Link href="/owners" className="text-sm font-medium text-blue-700 hover:underline">Back to owners</Link>}
      rail={
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white p-3 text-sm text-gray-700">
            Creating an owner also links them to their unit via occupancy record. Portal access can be enabled to let them sign in.
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-gray-500">After save</div>
            <div className="mt-2 space-y-2">
              {ownerWorkflowCards.map((card) => (
                <Link key={card.href} href={card.href} className="block rounded border border-gray-200 p-3 text-sm hover:bg-gray-50">{card.title}</Link>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <form action={createOwner as any} className="max-w-5xl space-y-6 rounded border border-gray-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="first_name">First name <span className="text-red-500">*</span></Label>
            <Input id="first_name" name="first_name" required />
          </div>
          <div>
            <Label htmlFor="last_name">Last name <span className="text-red-500">*</span></Label>
            <Input id="last_name" name="last_name" required />
          </div>
          <div>
            <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
            <Input id="email" name="email" type="email" required placeholder="owner@example.com" />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" placeholder="(312) 555-0100" />
          </div>
        </div>

        <section className="border-t border-gray-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Property assignment</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="association_id">Association <span className="text-red-500">*</span></Label>
              <select id="association_id" name="association_id" required className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">Select association</option>
                {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="unit_id">Unit <span className="text-red-500">*</span></Label>
              <select id="unit_id" name="unit_id" required className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">Select unit</option>
                {(units ?? []).map((u: any) => <option key={u.id} value={u.id}>Unit {u.unit_number}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="ownership_pct">Ownership %</Label>
              <Input id="ownership_pct" name="ownership_pct" type="number" min="0" max="100" defaultValue="100" placeholder="100" />
            </div>
            <div>
              <Label htmlFor="dues_amount">Monthly dues</Label>
              <Input id="dues_amount" name="dues_amount" type="number" min="0" step="0.01" placeholder="350.00" />
            </div>
            <div>
              <Label htmlFor="move_in_date">Move-in date</Label>
              <Input id="move_in_date" name="move_in_date" type="date" />
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Portal access</div>
          <div className="grid grid-cols-1 gap-4">
            <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
              <input type="checkbox" name="activate_portal" className="mt-1" defaultChecked />
              <span>
                <span className="block text-sm font-medium text-gray-900">Activate owner portal</span>
                <span className="block text-xs text-gray-500">Creates a login account so the owner can view their balance, pay dues, and submit maintenance requests.</span>
              </span>
            </label>
            <div>
              <Label htmlFor="portal_password">Portal password</Label>
              <Input id="portal_password" name="portal_password" type="text" placeholder="Auto-generated if left blank" />
              <p className="mt-1 text-xs text-gray-400">Leave blank for a random secure password. The owner can reset it later.</p>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Mailing address</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-4"><Label htmlFor="address_street">Street</Label><Input id="address_street" name="address_street" /></div>
            <div className="md:col-span-2"><Label htmlFor="address_city">City</Label><Input id="address_city" name="address_city" /></div>
            <div><Label htmlFor="address_state">State</Label><Input id="address_state" name="address_state" maxLength={2} className="uppercase" /></div>
            <div><Label htmlFor="address_zip">ZIP</Label><Input id="address_zip" name="address_zip" /></div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="preferred_comm">Preferred communication</Label>
              <select id="preferred_comm" name="preferred_comm" defaultValue="email" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="email">Email</option>
                <option value="mail">Postal mail</option>
                <option value="phone">Phone</option>
                <option value="portal">Portal</option>
              </select>
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <Label htmlFor="notes">Internal notes</Label>
          <textarea id="notes" name="notes" rows={3} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" placeholder="Language preference, accessibility needs, ownership context..." />
        </section>

        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/owners" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Create owner</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
