import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import NewInsuranceForm from './new-insurance-form';

export const dynamic = 'force-dynamic';

async function addPolicy(formData: FormData) {
  'use server';
  await (await import('@/lib/auth/me')).requireStaff();  // in-action guard
  const supabase = await createClient();
  const db = supabase as any;
  const failTo = (msg: string) => redirect(`/insurance/new?error=${encodeURIComponent(msg)}`);

  const { error } = await db.from('insurance_policies').insert({
    owner_id: formData.get('owner_id') as string,
    association_id: (formData.get('association_id') as string) || null,
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

  const [{ data: owners }, { data: associations }] = await Promise.all([
    db.from('owners').select('id, full_name').is('archived_at', null).order('full_name'),
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
  ]);

  return (
    <NewInsuranceForm
      owners={owners ?? []}
      associations={associations ?? []}
      addPolicy={addPolicy}
      serverError={sp.error ?? null}
    />
  );
}
