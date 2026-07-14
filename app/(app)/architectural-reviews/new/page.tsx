import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea, Field } from '@/components/ui/input';
import { Alert, EmptyState } from '@/components/ui/shell';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { submitArchitecturalRequestOnBehalf } from '@/lib/rpcs/architectural';

export const dynamic = 'force-dynamic';

const CATEGORY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'exterior_paint', label: 'Exterior paint / color' },
  { value: 'fence',          label: 'Fence / wall' },
  { value: 'landscaping',    label: 'Landscaping' },
  { value: 'roof',           label: 'Roof' },
  { value: 'addition',       label: 'Addition / structural' },
  { value: 'deck_patio',     label: 'Deck / patio' },
  { value: 'windows_doors',  label: 'Windows / doors' },
  { value: 'solar',          label: 'Solar panels' },
  { value: 'pool',           label: 'Pool / spa' },
  { value: 'other',          label: 'Other' },
];

type OccRow = {
  id: string;
  unit_id: string;
  owner_id: string | null;
  association_id: string;
  units: { unit_number: string | null } | null;
  owners: { full_name: string | null } | null;
  associations: { name: string | null } | null;
};

export default async function NewArchitecturalRequestForOwner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; association?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  // Current occupancies = the live owner↔unit roster, RLS-scoped to this
  // staffer's associations. One row = one (owner, unit) pairing, so picking a
  // row picks the association, unit, AND owner in a single consistent choice.
  const { data: occRows } = await db
    .from('occupancies')
    .select('id, unit_id, owner_id, association_id, units!occupancies_unit_id_fkey(unit_number), owners!occupancies_owner_id_fkey(full_name), associations!occupancies_association_id_fkey(name)')
    .eq('status', 'current')
    .not('owner_id', 'is', null)
    .limit(2000);

  const occupancies = ((occRows ?? []) as OccRow[]).sort((a, b) => {
    const assoc = (a.associations?.name ?? '').localeCompare(b.associations?.name ?? '');
    if (assoc !== 0) return assoc;
    return (a.units?.unit_number ?? '').localeCompare(b.units?.unit_number ?? '', undefined, { numeric: true });
  });

  // Group into <optgroup> per association so staff "pick an association" first.
  const byAssociation = new Map<string, { name: string; rows: OccRow[] }>();
  for (const o of occupancies) {
    const key = o.association_id;
    if (!byAssociation.has(key)) byAssociation.set(key, { name: o.associations?.name ?? 'Association', rows: [] });
    byAssociation.get(key)!.rows.push(o);
  }

  return (
    <DataWorkspace
      title="New Architectural Request"
      description="Submit a request on a homeowner's behalf — for owners who call in or hand you paper plans. It enters the same review queue as portal submissions."
      actions={<Link href="/architectural-reviews"><Button variant="secondary">Back to queue</Button></Link>}
    >
      <div className="max-w-3xl space-y-5">
        {sp.error && <Alert tone="danger" title="Could not submit request">{sp.error}</Alert>}

        {occupancies.length === 0 ? (
          <EmptyState
            title="No homeowners on file"
            description="Add owners and link them to units first — then you can file architectural requests on their behalf."
          />
        ) : (
          <form action={submitArchitecturalRequestOnBehalf as any} className="space-y-6 rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <Field
              label="Homeowner & unit"
              htmlFor="occupancy_id"
              required
              hint="Grouped by association. The request is filed under this owner — they'll see it in their portal and can join the discussion there."
            >
              <Select id="occupancy_id" name="occupancy_id" required defaultValue="">
                <option value="">Choose an association / unit / owner…</option>
                {[...byAssociation.entries()].map(([assocId, group]) => (
                  <optgroup key={assocId} label={group.name}>
                    {group.rows.map((o) => (
                      <option key={o.id} value={o.id}>
                        Unit {o.units?.unit_number ?? '—'} — {o.owners?.full_name ?? 'Owner'}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>

            <Field label="Title" htmlFor="title" required>
              <Input id="title" name="title" required maxLength={120} placeholder="e.g. Repaint front door and trim" />
            </Field>

            <Field label="Type of modification" htmlFor="category">
              <Select id="category" name="category" defaultValue="other">
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </Field>

            <Field
              label="Describe the work"
              htmlFor="description"
              required
              hint="After you submit, attach the owner's plans, drawings, quotes, or photos from the request page (up to 10 documents, 10 MB each)."
            >
              <Textarea
                id="description"
                name="description"
                required
                minLength={10}
                rows={6}
                placeholder="What is the owner changing — materials, colors, dimensions, and where on the property?"
              />
            </Field>

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <Link href="/architectural-reviews" className="text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
              <Button type="submit" size="lg">Submit request</Button>
            </div>
          </form>
        )}
      </div>
    </DataWorkspace>
  );
}
