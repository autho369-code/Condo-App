// New Property (physical asset) — replicates AppFolio's New Property form but
// scoped to a single Building under an existing Association.
//
// See PROJECT_HANDOFF.md §0 for the Association vs Building distinction.
// Summary: Associations = legal/financial entity; Buildings = physical asset.
// This page creates the Building. The parent Association must already exist.
//
// Required URL param: ?association=<uuid>
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { createBuilding } from '@/lib/rpcs/entities';

export const dynamic = 'force-dynamic';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const PROPERTY_TYPES = [
  { value: 'hoa',            label: 'HOA' },
  { value: 'condo',          label: 'Condo Association' },
  { value: 'coop',           label: 'Cooperative' },
  { value: 'commercial',     label: 'Commercial' },
  { value: 'single_family',  label: 'Single Family' },
  { value: 'multi_family',   label: 'Multi Family' },
  { value: 'mixed',          label: 'Mixed Use' },
];
const CURRENT_YEAR = new Date().getFullYear();

export default async function NewBuildingPage({
  searchParams,
}: {
  searchParams: Promise<{ association?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const associationId = sp.association;

  // Must have a parent association — this page can't exist in the abstract.
  if (!associationId) redirect('/associations');

  const supabase = await createClient();

  const [{ data: assoc }, { data: propertyGroups }] = await Promise.all([
    supabase.from('associations').select('id, name').eq('id', associationId).maybeSingle(),
    supabase.from('property_groups').select('id, name').order('name'),
  ]);

  if (!assoc) redirect('/associations');

  return (
    <div className="mx-auto max-w-5xl px-8 py-6">
      <div className="mb-4">
        <Link href={`/associations/${assoc.id}`} className="text-sm text-blue-700 hover:underline">
          ← {assoc.name}
        </Link>
      </div>
      <h1 className="mb-1 text-2xl font-semibold text-gray-900">New Property</h1>
      <p className="mb-4 text-sm text-gray-500">
        Add a physical building under <strong>{assoc.name}</strong>. One association can govern many buildings.
      </p>

      <form action={createBuilding as any} className="space-y-4">
        <input type="hidden" name="association_id" value={assoc.id} />

        {/* ============================================================
            1. PROPERTY NAME AND ADDRESS
           ============================================================ */}
        <Card>
          <CardTitle>Property Name and Address</CardTitle>
          <div className="space-y-4 px-5 py-4">
            <Row label="Property Type" required>
              <select name="property_type" required defaultValue="hoa" className={input()}>
                {PROPERTY_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </Row>
            <Row label="Property Name" required>
              <input name="name" required placeholder={`${assoc.name} — Main Building`} className={input()} />
            </Row>
            <Row label="Address" required>
              <div className="space-y-2">
                <input name="address" required placeholder="Address 1" className={input()} />
                <input name="address_line_2" placeholder="Address 2" className={input()} />
                <div className="grid grid-cols-12 gap-2">
                  <input name="city" required placeholder="City" className={`${input()} col-span-6`} />
                  <select name="state" required defaultValue="" className={`${input()} col-span-3`}>
                    <option value="">State</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input name="zip" required placeholder="Zip" className={`${input()} col-span-3`} />
                </div>
              </div>
            </Row>
            <Row label="County">
              <input name="county" placeholder="Cook County" className={input()} />
            </Row>
            <Row label="Lockbox ID">
              <input name="lockbox_id" placeholder="Optional" className={input()} />
            </Row>
          </div>
        </Card>

        {/* ============================================================
            2. PROPERTY INFORMATION
           ============================================================ */}
        <Card>
          <CardTitle>Property Information</CardTitle>
          <div className="space-y-4 px-5 py-4">
            <Row label="Description">
              <textarea name="description" rows={3} className={`${input()} h-auto py-2`} />
            </Row>
            <Row label="Site Manager">
              <div className="grid grid-cols-12 gap-2">
                <input name="site_manager" placeholder="First Name Last Name" className={`${input()} col-span-6`} />
                <input name="site_manager_phone" placeholder="Phone Number" className={`${input()} col-span-6`} />
              </div>
            </Row>
            <Row label="Year Built">
              <input name="year_built" type="number" min="1800" max={CURRENT_YEAR} className={`${input()} max-w-[160px]`} />
            </Row>
            <Row label="Management Start Date">
              <input name="management_start_date" type="date" className={`${input()} max-w-[200px]`} />
            </Row>
            <Row label="Amenities" help="Comma-separated: pool, gym, clubhouse">
              <input name="amenities" placeholder="pool, gym, clubhouse" className={input()} />
              <div className="mt-1 text-xs">
                <Link href="/settings" className="text-blue-700 hover:underline">Manage Amenity Tags</Link>
              </div>
            </Row>
          </div>
        </Card>

        {/* ============================================================
            3. MAINTENANCE INFORMATION
           ============================================================ */}
        <Card>
          <CardTitle>Maintenance Information</CardTitle>
          <div className="space-y-4 px-5 py-4">
            <Row label="Maintenance Limit">
              <MoneyInput name="maintenance_limit" defaultValue="0.00" />
            </Row>
            <Row label="Insurance Expiration">
              <input name="insurance_expiration" type="date" className={`${input()} max-w-[200px]`} />
            </Row>
            <Row label="Is it covered by home warranty?">
              <input type="checkbox" name="home_warranty_covered" className="h-4 w-4" />
            </Row>
            <Row label="Unit Entry Pre-authorized">
              <input type="checkbox" name="unit_entry_pre_authorized" className="h-4 w-4" />
            </Row>
            <Row label="Disable Online Maintenance Requests">
              <input type="checkbox" name="disable_online_maintenance_requests" className="h-4 w-4" />
            </Row>
            <Row label="Maintenance Notes">
              <textarea name="maintenance_notes" rows={2} className={`${input()} h-auto py-2`} />
            </Row>
            <Row label="Online Maintenance Request Instructions">
              <textarea
                name="online_maintenance_request_instructions"
                rows={3}
                className={`${input()} h-auto py-2`}
                placeholder="e.g. In case of water leaks, do not file a maintenance request, call (800) 555-5555."
              />
            </Row>
          </div>
        </Card>

        {/* ============================================================
            4. PROPERTY GROUPS (optional tagging)
           ============================================================ */}
        <Card>
          <CardTitle>Property Groups</CardTitle>
          <div className="space-y-3 px-5 py-4">
            {(propertyGroups ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">
                No property groups defined. Create one in{' '}
                <Link href="/settings" className="text-blue-700 hover:underline">Settings</Link>.
              </p>
            ) : (
              <select name="property_group_id" defaultValue="" className={input()}>
                <option value="">— None —</option>
                {(propertyGroups ?? []).map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
          </div>
        </Card>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" size="lg">Save Property</Button>
          <Link href={`/associations/${assoc.id}`} className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
        </div>
      </form>

      {/* Bank accounts, photos, notes, attachments, lease templates, owner
          distributions, management fees, late fee policy, budgets — all live
          on the Association, not the Building. After saving, head to the
          Association detail page. */}
    </div>
  );
}

// ============================================================================
// Presentational helpers
// ============================================================================

function Card({ children }: { children: React.ReactNode }) {
  return <section className="overflow-hidden rounded border border-gray-200 bg-white">{children}</section>;
}
function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">{children}</h2>;
}
function Row({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-12 items-start gap-4">
      <label className="col-span-4 pt-2 text-right text-sm text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
        {help && (
          <span title={help} className="ml-1 inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-gray-300 text-[10px] font-semibold text-white">
            ?
          </span>
        )}
      </label>
      <div className="col-span-8">{children}</div>
    </div>
  );
}
function MoneyInput({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <div className="relative max-w-[180px]">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
      <input
        name={name}
        type="number"
        step="0.01"
        min="0"
        defaultValue={defaultValue ?? ''}
        className={`${input()} pl-6`}
      />
    </div>
  );
}
function input(extra = '') {
  return `h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${extra}`;
}
