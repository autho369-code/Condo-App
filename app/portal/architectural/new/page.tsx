import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { submitArchitecturalRequest } from '@/lib/rpcs/architectural';

export const dynamic = 'force-dynamic';

type UnitOption = {
  unit_id: string | null;
  unit_number: string | null;
  association_id: string | null;
};

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

export default async function NewArchitecturalRequest({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireAuth();

  if (!me.is_resident && !me.is_board) redirect('/portal');

  const supabase = await createClient();

  // RLS on v_unit_account_summary filters to the units this owner belongs to.
  const { data: units } = await (supabase as any)
    .from('v_unit_account_summary')
    .select('unit_id, unit_number, association_id');

  const unitOptions = (units ?? []) as UnitOption[];
  const associationIds = Array.from(
    new Set(unitOptions.map((u) => u.association_id).filter((id): id is string => Boolean(id)))
  );
  const { data: associations } = associationIds.length
    ? await (supabase as any).from('associations').select('id, name').in('id', associationIds)
    : { data: [] };
  const associationNameById = new Map<string, string>(
    ((associations ?? []) as Array<{ id: string; name: string }>).map((a) => [a.id, a.name])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <Link href="/portal/architectural" className="hover:text-gray-950 hover:underline">← Back to architectural requests</Link>
      </div>

      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Submit an architectural request</h1>
        <p className="mt-1.5 text-sm leading-6 text-gray-500">
          Most exterior changes need approval before work begins. Describe what you&apos;d like to do — the
          board or architectural committee will review and may ask follow-up questions right here in the thread.
        </p>
      </div>

      {sp.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <span className="font-semibold">Could not submit request:</span> {sp.error}
        </div>
      )}

      {unitOptions.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-gray-600">
              You don&apos;t have a unit on file yet. Contact your property manager so they can link your account to your unit.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Request details</CardTitle></CardHeader>
          <CardBody>
            <form action={submitArchitecturalRequest as any} className="space-y-6">
              <div>
                <Label htmlFor="unit_id">Unit</Label>
                {unitOptions.length === 1 ? (
                  <>
                    <input type="hidden" name="unit_id" value={unitOptions[0].unit_id ?? ''} />
                    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                      {formatUnitLabel(unitOptions[0], associationNameById)}
                    </div>
                  </>
                ) : (
                  <select id="unit_id" name="unit_id" required
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                    <option value="">Choose a unit…</option>
                    {unitOptions.map((u) => (
                      <option key={u.unit_id} value={u.unit_id ?? ''}>{formatUnitLabel(u, associationNameById)}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required maxLength={120} placeholder="e.g. Repaint front door and trim" />
              </div>

              <div>
                <Label htmlFor="category">Type of modification</Label>
                <select id="category" name="category" defaultValue="other"
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15">
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="description">Describe the work</Label>
                <textarea
                  id="description"
                  name="description"
                  required
                  minLength={10}
                  rows={6}
                  placeholder="What are you changing, what materials/colors, dimensions, and where on the property? The more detail, the faster the review."
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                />
                <p className="mt-1 text-xs text-gray-500">After you submit, you&apos;ll upload your supporting documents — plans, drawings, quotes, photos — one at a time (up to 10, max 10 MB each), so large files upload reliably.</p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <Link href="/portal/architectural" className="text-sm text-gray-600 hover:underline">Cancel</Link>
                <Button type="submit" size="lg">Submit request</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function formatUnitLabel(
  unit: { association_id: string | null; unit_number: string | null },
  associationNameById: Map<string, string>
): string {
  const name = unit.association_id ? associationNameById.get(unit.association_id) ?? 'Association' : 'Association';
  return `${name} - Unit ${unit.unit_number ?? '-'}`;
}
