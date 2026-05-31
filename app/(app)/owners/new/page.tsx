import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { requireStaff } from '@/lib/auth/me';
import { createOwner } from '@/lib/rpcs/entities';

export const dynamic = 'force-dynamic';

export default async function NewOwnerPage() {
  await requireStaff();

  return (
    <DataWorkspace
      title="New Owner"
      description="Create the owner profile, then connect unit ownership, portal activation, ACH, and packet workflows."
      actions={<Link href="/owners" className="text-sm font-medium text-blue-700 hover:underline">Back to owners</Link>}
      rail={
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white p-3 text-sm text-gray-700">
            Add a clean owner record first. Unit links, portal invites, and packets can be staged once the owner exists.
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
            <Input id="phone" name="phone" type="tel" placeholder="(555) 555-5555" />
          </div>
        </div>

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
            <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
              <input type="checkbox" name="electronic_consent_requested" className="mt-1" />
              <span><span className="block text-sm font-medium text-gray-900">Request electronic consent after save</span><span className="block text-xs text-gray-500">Use the owner form workflow to stage the request.</span></span>
            </label>
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
