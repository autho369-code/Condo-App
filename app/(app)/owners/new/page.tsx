import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { createOwnerWithDetails } from './actions';
import { FeeScheduleBuilder, type FeeCategory } from './fee-schedule-builder';

export const dynamic = 'force-dynamic';

export default async function NewOwnerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;
  const [{ data: associations }, { data: units }, { data: categories }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('units').select('id, unit_number, buildings!inner(association_id)').is('archived_at', null).order('unit_number'),
    db.from('charge_categories').select('id, name, default_amount, default_frequency, charge_type')
      .eq('portfolio_id', me.portfolio?.id).eq('active', true).is('archived_at', null).order('sort_order'),
  ]);

  const inputCls = 'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20';

  return (
    <DataWorkspace
      title="New Owner"
      description="Create the owner, assign the unit, set up the full fee schedule, and capture tenant/lease details if the unit is rented."
      actions={<Link href="/owners"><Button variant="secondary">Back to owners</Button></Link>}
    >
      <form action={createOwnerWithDetails} className="max-w-5xl space-y-6 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {sp.error && <Alert tone="danger" title="Could not create owner">{sp.error}</Alert>}

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
              <select id="association_id" name="association_id" required className={inputCls}>
                <option value="">Select association</option>
                {(associations ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="unit_id">Unit <span className="text-red-500">*</span></Label>
              <select id="unit_id" name="unit_id" required className={inputCls}>
                <option value="">Select unit</option>
                {(units ?? []).map((u: any) => <option key={u.id} value={u.id}>Unit {u.unit_number}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="ownership_pct">Ownership %</Label>
              <Input id="ownership_pct" name="ownership_pct" type="number" min="0" max="100" defaultValue="100" placeholder="100" />
            </div>
            <div>
              <Label htmlFor="dues_amount">Monthly dues (regular assessment)</Label>
              <Input id="dues_amount" name="dues_amount" type="number" min="0" step="0.01" placeholder="350.00" />
            </div>
            <div>
              <Label htmlFor="move_in_date">Move-in date</Label>
              <Input id="move_in_date" name="move_in_date" type="date" />
            </div>
          </div>
        </section>

        {/* ── Recurring fee schedule ── */}
        <section className="border-t border-gray-100 pt-5">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">Additional monthly fees</div>
          <p className="mb-3 text-xs text-gray-500">
            Parking (with space #), storage / bike locker (with locker #), internet, special assessment, move fees, and any custom fee.
            Need a fee type that isn&apos;t listed? <Link href="/charge-categories/new" className="font-medium text-gray-700 hover:text-gray-950 hover:underline">Create a custom fee type →</Link>
          </p>
          <FeeScheduleBuilder categories={(categories ?? []) as FeeCategory[]} />
        </section>

        {/* ── Rental / tenant ── */}
        <section className="border-t border-gray-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Rental status</div>
          <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <input type="checkbox" name="is_rented" className="mt-1" />
            <span>
              <span className="block text-sm font-medium text-gray-900">This unit is rented to a tenant</span>
              <span className="block text-xs text-gray-500">Capture the tenant and lease below. You can add more tenants, pets, and upload the lease &amp; insurance later on the owner&apos;s page.</span>
            </span>
          </label>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="tenant_first_name">Tenant first name</Label>
              <Input id="tenant_first_name" name="tenant_first_name" />
            </div>
            <div>
              <Label htmlFor="tenant_last_name">Tenant last name</Label>
              <Input id="tenant_last_name" name="tenant_last_name" />
            </div>
            <div>
              <Label htmlFor="tenant_email">Tenant email</Label>
              <Input id="tenant_email" name="tenant_email" type="email" />
            </div>
            <div>
              <Label htmlFor="tenant_phone">Tenant phone</Label>
              <Input id="tenant_phone" name="tenant_phone" type="tel" />
            </div>
            <div>
              <Label htmlFor="tenant_lease_start">Lease start</Label>
              <Input id="tenant_lease_start" name="tenant_lease_start" type="date" />
            </div>
            <div>
              <Label htmlFor="tenant_lease_end">Lease end</Label>
              <Input id="tenant_lease_end" name="tenant_lease_end" type="date" />
            </div>
            <div>
              <Label htmlFor="tenant_emergency_contact_name">Tenant emergency contact</Label>
              <Input id="tenant_emergency_contact_name" name="tenant_emergency_contact_name" />
            </div>
            <div>
              <Label htmlFor="tenant_emergency_contact_phone">Emergency contact phone</Label>
              <Input id="tenant_emergency_contact_phone" name="tenant_emergency_contact_phone" type="tel" />
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Portal access</div>
          <div className="grid grid-cols-1 gap-4">
            <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
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
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Mailing address (if different from the unit)</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-4"><Label htmlFor="address_street">Street</Label><Input id="address_street" name="address_street" /></div>
            <div className="md:col-span-2"><Label htmlFor="address_city">City</Label><Input id="address_city" name="address_city" /></div>
            <div><Label htmlFor="address_state">State</Label><Input id="address_state" name="address_state" maxLength={2} className="uppercase" /></div>
            <div><Label htmlFor="address_zip">ZIP</Label><Input id="address_zip" name="address_zip" /></div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="preferred_comm">Preferred communication</Label>
              <select id="preferred_comm" name="preferred_comm" defaultValue="email" className={inputCls}>
                <option value="email">Email</option>
                <option value="mail">Postal mail</option>
                <option value="phone">Phone</option>
                <option value="portal">Portal</option>
              </select>
            </div>
            <div>
              <Label htmlFor="emergency_contact_name">Owner emergency contact</Label>
              <Input id="emergency_contact_name" name="emergency_contact_name" />
            </div>
            <div>
              <Label htmlFor="emergency_contact_phone">Emergency contact phone</Label>
              <Input id="emergency_contact_phone" name="emergency_contact_phone" type="tel" />
            </div>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-5">
          <Label htmlFor="notes">Internal notes</Label>
          <textarea id="notes" name="notes" rows={3} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="Language preference, accessibility needs, ownership context..." />
        </section>

        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/owners" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Create owner</Button>
        </div>
      </form>
    </DataWorkspace>
  );
}
