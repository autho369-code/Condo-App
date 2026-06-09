'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createAgreement(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from('management_agreements').insert({
    owner_id: formData.get('owner_id') || null,
    association_id: formData.get('association_id') || null,
    management_start_date: formData.get('management_start_date') || null,
    agreement_signature_due_date: formData.get('agreement_signature_due_date') || null,
    management_fee: formData.get('management_fee') ? parseFloat(formData.get('management_fee') as string) : null,
    delivery_method: formData.get('delivery_method') || 'email',
    terms: formData.get('terms') || '',
  });
  if (error) { console.error('Failed to create agreement:', error); return; }
  revalidatePath('/owners');
}
