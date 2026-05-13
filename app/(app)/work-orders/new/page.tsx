import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { createWorkOrder } from '@/lib/rpcs/work-orders';

export const dynamic = 'force-dynamic';

const PRIORITIES = ['low', 'normal', 'high', 'emergency'];
const CATEGORIES = ['plumbing', 'electrical', 'hvac', 'general_repair', 'common_area', 'appliance', 'pest_control', 'landscaping', 'other'];
const TRADES = ['hvac', 'plumbing', 'electrical', 'landscaping', 'roofing', 'general_contractor', 'handyperson', 'snow_removal', 'pest_control', 'pool_spa', 'painting', 'keys_locks', 'fireplace_chimney', 'garage_doors', 'gutter_cleaning', 'inspections', 'parking_driveways', 'preventative_maintenance', 'repairs_exterior', 'repairs_interior', 'septic', 'trash_recycling', 'utilities', 'turnover', 'other'];

function label(value: string) {
  return value.replace(/_/g, ' ');
}

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ association_id?: string; unit_id?: string }>;
}) {
  const me = await requireStaff();
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: associations }, { data: units }, { data: vendors }] = await Promise.all([
    (supabase as any)
      .from('associations')
      .select('id, name')
      .is('archived_at', null)
      .order('name'),
    (supabase as any)
      .from('units')
      .select('id, unit_number, buildings(associations(id, name))')
      .is('archived_at', null)
      .order('unit_number'),
    (supabase as any)
      .from('vendors')
      .select('id, name, trade')
      .is('archived_at', null)
      .order('name'),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-8 py-6">
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <nav className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            <Link href="/work-orders" className="hover:text-champagne-700">Work orders</Link>
            <span className="mx-2">/</span>
            New
          </nav>
          <h1 className="mt-1 font-display text-3xl tracking-editorial text-ink-900">New work order</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-500">
            Create a trackable maintenance item, assign a vendor when known, and route it into the work-order lifecycle.
          </p>
        </div>
        <Link href="/work-orders">
          <Button type="button" variant="secondary" size="sm">Cancel</Button>
        </Link>
      </div>

      <form action={createWorkOrder as any} className="space-y-6">
        <input type="hidden" name="portfolio_id" value={me.portfolio?.id ?? ''} />

        <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft-sm">
          <h2 className="font-display text-lg tracking-editorial text-ink-900">Work details</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required placeholder="Leak under kitchen sink" />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="issue">Issue description</Label>
              <textarea
                id="issue"
                name="issue"
                required
                rows={5}
                className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60"
                placeholder="Describe the problem, location, access constraints, and anything the vendor should know."
              />
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <select id="priority" name="priority" defaultValue="normal" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900">
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{label(priority)}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <select id="category" name="category" defaultValue="general_repair" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900">
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>{label(category)}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="trade">Trade</Label>
              <select id="trade" name="trade" defaultValue="" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900">
                <option value="">Not sure yet</option>
                {TRADES.map((trade) => (
                  <option key={trade} value={trade}>{label(trade)}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="requested_by">Requested by</Label>
              <Input id="requested_by" name="requested_by" placeholder="Resident, board member, staff" />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft-sm">
          <h2 className="font-display text-lg tracking-editorial text-ink-900">Association and scheduling</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="association_id">Association</Label>
              <select id="association_id" name="association_id" required defaultValue={params.association_id ?? ''} className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900">
                <option value="">Select association</option>
                {(associations ?? []).map((association: any) => (
                  <option key={association.id} value={association.id}>{association.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="unit_id">Unit</Label>
              <select id="unit_id" name="unit_id" defaultValue={params.unit_id ?? ''} className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900">
                <option value="">Common area or no unit</option>
                {(units ?? []).map((unit: any) => {
                  const association = unit.buildings?.associations;
                  return (
                    <option key={unit.id} value={unit.id}>
                      {association?.name ? `${association.name} - ` : ''}Unit {unit.unit_number}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <Label htmlFor="scheduled_date">Scheduled date</Label>
              <Input id="scheduled_date" name="scheduled_date" type="date" />
            </div>

            <div>
              <Label htmlFor="scheduled_time">Scheduled time</Label>
              <Input id="scheduled_time" name="scheduled_time" type="time" />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="owner_availability">Access / availability</Label>
              <Input id="owner_availability" name="owner_availability" placeholder="Weekdays after 5pm, call before arrival, key in lockbox" />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft-sm">
          <h2 className="font-display text-lg tracking-editorial text-ink-900">Vendor dispatch</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="vendor_id">Vendor</Label>
              <select id="vendor_id" name="vendor_id" defaultValue="" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm text-ink-900">
                <option value="">Leave unassigned</option>
                {(vendors ?? []).map((vendor: any) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}{vendor.trade ? ` (${vendor.trade})` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-500">Assigning a vendor starts the order in assigned status.</p>
            </div>

            <div>
              <Label htmlFor="vendor_instructions">Vendor instructions</Label>
              <textarea
                id="vendor_instructions"
                name="vendor_instructions"
                rows={4}
                className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60"
                placeholder="Scope notes, photos requested, billing expectations."
              />
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-ink-100 bg-white p-5 shadow-soft-sm">
          <h2 className="font-display text-lg tracking-editorial text-ink-900">Internal notes</h2>
          <textarea
            id="internal_notes"
            name="internal_notes"
            rows={5}
            className="mt-4 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60"
            placeholder="Board sensitivity, budget concern, inspection notes."
          />
        </section>

        <div className="flex items-center justify-end gap-2">
          <Link href="/work-orders">
            <Button type="button" variant="secondary">Cancel</Button>
          </Link>
          <Button type="submit">Create work order</Button>
        </div>
      </form>
    </div>
  );
}
