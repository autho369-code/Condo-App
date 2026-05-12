import Link from 'next/link';
import { requireStaff } from '@/lib/auth/me';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createOwner } from '@/lib/rpcs/entities';

export const dynamic = 'force-dynamic';

export default async function NewOwnerPage() {
  await requireStaff();

  return (
    <div className="mx-auto max-w-3xl px-8 py-6 space-y-4">
      <nav className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        <Link href="/owners" className="hover:text-brand-600">Owners</Link> · New owner
      </nav>
      <h1 className="text-2xl font-semibold text-gray-900">New owner</h1>
      <p className="text-sm text-gray-500">Add the owner record first. You&apos;ll link them to a unit afterwards.</p>

      <form action={createOwner as any} className="space-y-6 rounded border border-gray-200 bg-white p-5">
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

        <div className="border-t border-gray-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Mailing address</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-4"><Label htmlFor="address_street">Street</Label><Input id="address_street" name="address_street" /></div>
            <div className="md:col-span-2"><Label htmlFor="address_city">City</Label><Input id="address_city" name="address_city" /></div>
            <div><Label htmlFor="address_state">State</Label><Input id="address_state" name="address_state" maxLength={2} className="uppercase" /></div>
            <div><Label htmlFor="address_zip">ZIP</Label><Input id="address_zip" name="address_zip" /></div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <Label htmlFor="preferred_comm">Preferred communication</Label>
          <select id="preferred_comm" name="preferred_comm" defaultValue="email"
            className="h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm">
            <option value="email">Email</option>
            <option value="mail">Postal mail</option>
            <option value="phone">Phone</option>
          </select>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <Label htmlFor="notes">Internal notes</Label>
          <textarea id="notes" name="notes" rows={2}
            placeholder="Language preference, accessibility needs, history…"
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm" />
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-5">
          <Link href="/owners" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
          <Button type="submit" size="lg">Create owner</Button>
        </div>
      </form>
    </div>
  );
}
