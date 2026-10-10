import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/auth/me';
import { ownPortalUnitIds, unitFilter } from '@/lib/portal/own-units';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/card';
import { NewArchitecturalRequestForm, type UnitOption } from '@/components/architectural/new-request-form';

export const dynamic = 'force-dynamic';

type UnitRow = {
  unit_id: string | null;
  unit_number: string | null;
  association_id: string | null;
};

export default async function NewArchitecturalRequest() {
  const me = await requireOwner();
  if (!me.is_resident && !me.is_board) redirect('/portal');

  const supabase = await createClient();

  // RLS on v_unit_account_summary filters to the units this owner belongs to.
  const { data: units } = await (supabase as any)
    .from('v_unit_account_summary')
    .select('unit_id, unit_number, association_id')
    .in('unit_id', unitFilter(await ownPortalUnitIds(supabase, me.owner_ids)));

  const unitRows = (units ?? []) as UnitRow[];
  const associationIds = Array.from(
    new Set(unitRows.map((u) => u.association_id).filter((id): id is string => Boolean(id)))
  );
  const { data: associations } = associationIds.length
    ? await (supabase as any).from('associations').select('id, name').in('id', associationIds)
    : { data: [] };
  const nameById = new Map<string, string>(
    ((associations ?? []) as Array<{ id: string; name: string }>).map((a) => [a.id, a.name])
  );

  const unitOptions: UnitOption[] = unitRows
    .filter((u) => u.unit_id)
    .map((u) => ({
      value: u.unit_id as string,
      label: `${u.association_id ? nameById.get(u.association_id) ?? 'Association' : 'Association'} - Unit ${u.unit_number ?? '-'}`,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <Link href="/portal/architectural" className="hover:text-gray-950 hover:underline">← Back to architectural requests</Link>
      </div>

      <div>
        <h1 className="font-display text-[26px] font-bold leading-[1.12] tracking-[-0.025em] text-ink [text-wrap:balance] sm:text-[30px]">Submit an architectural request</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-6 text-gray-500">
          Most exterior changes need approval before work begins. Describe what you&apos;d like to do and attach
          your plans, quotes, and photos — the board or architectural committee will review and may ask
          follow-up questions right in the request&apos;s discussion thread.
        </p>
      </div>

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
            <NewArchitecturalRequestForm unitOptions={unitOptions} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
