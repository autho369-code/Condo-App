import { redirect } from 'next/navigation';

// Default landing for an association detail is the Units tab,
// matching AppFolio's behavior at /properties/[id] -> /properties/[id]/units.
export default async function AssociationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/associations/${id}/units`);
}
