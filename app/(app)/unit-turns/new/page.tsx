import { redirect } from 'next/navigation';

// Unit turns are derived from work orders assigned to a unit — there is no
// separate unit_turns table. A new turn is a unit-assigned work order, so send
// the manager to the work-order form, keeping any unit/association preselected.
export default async function NewUnitTurnPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; unit_id?: string; association?: string }>;
}) {
  const sp = await searchParams;
  const unit = sp.unit ?? sp.unit_id;
  const params = new URLSearchParams();
  if (unit) params.set('unit', unit);
  if (sp.association) params.set('association', sp.association);
  const qs = params.toString();
  redirect(`/work-orders/new${qs ? `?${qs}` : ''}`);
}
