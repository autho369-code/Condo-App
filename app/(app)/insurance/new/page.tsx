import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import NewInsuranceForm from './new-insurance-form';

export const dynamic = 'force-dynamic';

async function addPolicy(formData: FormData) {
  'use server';
  await (await import('@/lib/auth/me')).requireStaff();  // in-action guard
  const supabase = await createClient();
  const db = supabase as any;
  const failTo = (msg: string) => redirect(`/insurance/new?error=${encodeURIComponent(msg)}`);

  // An owner has one record per association: the record must belong to the
  // chosen association (and be visible to this staff member).
  const ownerId = ((formData.get('owner_id') as string) || '').trim();
  const associationId = ((formData.get('association_id') as string) || '').trim();
  if (!ownerId || !associationId) failTo('Choose an association and one of its owners.');
  const { data: owner, error: ownerError } = await db.from('owners').select('id')
    .eq('id', ownerId).eq('association_id', associationId).is('archived_at', null).maybeSingle();
  if (ownerError) failTo(ownerError.message);
  if (!owner) failTo('That owner is not in the chosen association.');

  // Notes are moved to the staff-only insurance_policy_private table by a
  // trigger; a newer policy archives the owner's earlier active one there too.
  const { error } = await db.from('insurance_policies').insert({
    owner_id: ownerId,
    association_id: associationId,
    policy_number: formData.get('policy_number') as string,
    insurance_company: formData.get('insurance_company') as string,
    coverage_amount: parseFloat(formData.get('coverage_amount') as string) || null,
    liability_amount: parseFloat(formData.get('liability_amount') as string) || null,
    deductible_amount: parseFloat(formData.get('deductible_amount') as string) || null,
    effective_date: formData.get('effective_date') as string,
    expiration_date: formData.get('expiration_date') as string,
    notes: (formData.get('notes') as string) || null,
    extraction_status: 'manual',
  });

  if (error) failTo(error.message);
  revalidatePath('/insurance');
  redirect('/insurance');
}

export default async function NewInsurancePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const supabase = await createClient();
  const db = supabase as any;

  const [ownersRes, { data: associations }] = await Promise.all([
    // Every owner (one request stops at 1,000 rows).
    fetchAllRows<any>(() => db.from('owners').select('id, full_name, association_id').is('archived_at', null).order('full_name').order('id')),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);
  const ownersError = ownersRes.error
    ? `Could not load every owner: ${ownersRes.error}`
    : ownersRes.truncated ? 'There are more owners than this form can list. Contact support.' : null;

  return (
    <NewInsuranceForm
      owners={ownersRes.rows}
      associations={associations ?? []}
      addPolicy={addPolicy}
      serverError={sp.error ?? ownersError}
    />
  );
}
