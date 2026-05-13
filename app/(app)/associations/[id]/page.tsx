import { redirect } from 'next/navigation';

// Default landing for an association detail is the Units tab,
// Association detail defaults to the unit roster.
export default async function AssociationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/associations/${id}/units`);
}
