import { redirect } from 'next/navigation';

// Unit turns are work orders with trade = 'turnover' — there is no separate
// unit_turns table. Send the manager to the work-order form with the turnover
// trade preset, keeping any unit/association preselected.
export default async function NewUnitTurnPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; unit_id?: string; association?: string }>;
}) {
  const sp = await searchParams;
  const unit = sp.unit ?? sp.unit_id;
  const params = new URLSearchParams();
  params.set('trade', 'turnover');
  if (unit) params.set('unit', unit);
  if (sp.association) params.set('association', sp.association);
  redirect(`/work-orders/new?${params.toString()}`);
}
