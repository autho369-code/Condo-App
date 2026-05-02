import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { createUnit, createBuilding } from '@/lib/rpcs/entities';

export const dynamic = 'force-dynamic';

// Search params support prefilling:
//   ?building=<id>       → building already chosen
//   ?association=<id>    → scoped to one association; pick a building from its list
export default async function NewUnitPage({
  searchParams,
}: {
  searchParams: Promise<{ building?: string; association?: string }>;
}) {
  await requireStaff();
  const { building: buildingId, association: associationId } = await searchParams;
  const supabase = await createClient();

  // Load data according to context
  const { data: associations } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .is('archived_at', null)
    .order('name');

  const buildingsQuery = associationId
    ? (supabase as any).from('buildings').select('id, name, association_id, associations(name)').eq('association_id', associationId)
    : (supabase as any).from('buildings').select('id, name, association_id, associations(name)');
  const { data: buildings } = await buildingsQuery.is('archived_at', null).order('name');

  // If ?building= was specified, pre-resolve it to avoid showing the picker
  const preBuilding = buildingId
    ? (buildings ?? []).find((b: any) => b.id === buildingId)
    : null;

  const contextAssociation = associationId
    ? (associations ?? []).find((a: any) => a.id === associationId)
    : preBuilding
    ? { id: (preBuilding as any).association_id, name: (preBuilding as any).associations?.name }
    : null;

  // If no associations exist at all, redirect to /associations/new
  if ((associations ?? []).length === 0) redirect('/associations/new');

  // If there's no building picked and the user's scope has no buildings,
  // show a helper block instead of the form.
  const needsBuilding = !preBuilding && (buildings ?? []).length === 0;

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/units" className="hover:text-brand-600">Units</Link>
              {contextAssociation && (<>{' · '}<Link href={`/associations/${contextAssociation.id}`} className="hover:text-brand-600">{contextAssociation.name}</Link></>)}
            </>
          }
          title="New unit"
          subtitle={preBuilding ? `In building: ${(preBuilding as any).name}` : 'Tell us which building and the unit number.'}
        />
      }
      rail={
        <>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Required</div>
          <ul className="mb-5 space-y-1 text-sm text-gray-700">
            <li>• Building</li>
            <li>• Unit number</li>
            <li>• Ownership percentage (for assessment math)</li>
          </ul>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Optional</div>
          <ul className="space-y-1 text-sm text-gray-700">
            <li>• Square footage</li>
            <li>• Bedrooms / bathrooms</li>
            <li>• Parking + storage</li>
            <li>• Internal notes</li>
          </ul>
          <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            <strong>Ownership %</strong> is used to split common-area charges like reserves and maintenance. Most condos use square-footage-weighted percentages — when in doubt, the declaration of CC&amp;R&apos;s will have the exact values.
          </div>
        </>
      }
    >
      {needsBuilding ? (
        <Section title="You need a building first">
          <div className="px-5 py-5">
            <p className="text-sm text-gray-700">
              Units live under buildings. {contextAssociation ? (<>This association (<strong>{contextAssociation.name}</strong>) has no buildings yet.</>) : 'No buildings found in your portfolio yet.'}
            </p>
            {contextAssociation ? (
              <form action={createBuilding as any} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                <input type="hidden" name="association_id" value={contextAssociation.id} />
                <div className="md:col-span-2">
                  <Label htmlFor="b_name">Building name <span className="text-red-500">*</span></Label>
                  <Input id="b_name" name="name" required placeholder="e.g. Tower A" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="b_address">Address <span className="text-red-500">*</span></Label>
                  <Input id="b_address" name="address" required />
                </div>
                <div className="md:col-span-4 flex justify-end">
                  <Button type="submit">Create building first</Button>
                </div>
              </form>
            ) : (
              <Link href="/associations" className="mt-4 inline-block">
                <Button>Pick an association →</Button>
              </Link>
            )}
          </div>
        </Section>
      ) : (
        <Section title="Unit details">
          <form action={createUnit as any} className="space-y-6 px-5 py-5">
            {/* --- Location --- */}
            {preBuilding ? (
              <input type="hidden" name="building_id" value={(preBuilding as any).id} />
            ) : (
              <div>
                <Label htmlFor="building_id">Building <span className="text-red-500">*</span></Label>
                <select id="building_id" name="building_id" required
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                  <option value="">Choose a building…</option>
                  {(buildings ?? []).map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.associations?.name ? `— ${b.associations.name}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="unit_number">Unit number <span className="text-red-500">*</span></Label>
                <Input id="unit_number" name="unit_number" required placeholder="e.g. 3B, 201, A-14" />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="name">Unit name (optional)</Label>
                <Input id="name" name="name" placeholder="Rarely needed — e.g. Penthouse Suite" />
              </div>
            </div>

            {/* --- Size --- */}
            <div className="border-t border-gray-100 pt-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Size & layout</div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <Label htmlFor="bedrooms">Bedrooms</Label>
                  <Input id="bedrooms" name="bedrooms" type="number" min="0" max="20" />
                </div>
                <div>
                  <Label htmlFor="bathrooms">Bathrooms</Label>
                  <Input id="bathrooms" name="bathrooms" type="number" min="0" max="20" step="0.5" placeholder="e.g. 2.5" />
                </div>
                <div>
                  <Label htmlFor="sqft">Square feet</Label>
                  <Input id="sqft" name="sqft" type="number" min="0" placeholder="e.g. 1200" />
                </div>
                <div>
                  <Label htmlFor="ownership_pct">Ownership % <span className="text-red-500">*</span></Label>
                  <Input id="ownership_pct" name="ownership_pct" type="number" min="0" max="100" step="0.0001" defaultValue="0" required placeholder="e.g. 2.0833" />
                </div>
              </div>
            </div>

            {/* --- Parking / storage --- */}
            <div className="border-t border-gray-100 pt-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Parking & storage</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="parking_spaces">Parking spaces</Label>
                  <Input id="parking_spaces" name="parking_spaces" placeholder="e.g. P-14, P-15" />
                </div>
                <div>
                  <Label htmlFor="storage_number">Storage number</Label>
                  <Input id="storage_number" name="storage_number" placeholder="e.g. S-203" />
                </div>
              </div>
            </div>

            {/* --- Notes --- */}
            <div className="border-t border-gray-100 pt-5">
              <Label htmlFor="notes">Internal notes (optional)</Label>
              <textarea
                id="notes" name="notes" rows={3}
                placeholder="Anything staff should know — entry instructions, pet policy exception, etc."
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* --- Actions --- */}
            <div className="flex items-center justify-between border-t border-gray-100 pt-5">
              <Link href={contextAssociation ? `/associations/${contextAssociation.id}` : '/units'} className="text-sm text-gray-600 hover:text-gray-900">
                Cancel
              </Link>
              <Button type="submit" size="lg">Create unit</Button>
            </div>
          </form>
        </Section>
      )}
    </Workspace>
  );
}
