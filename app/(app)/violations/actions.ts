'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createViolation(formData: FormData) {
  const supabase = await createClient();
  
  const violation = {
    association_id: formData.get('association_id') || null,
    unit_id: formData.get('unit_id') || null,
    owner_id: formData.get('owner_id') || null,
    violation_type: formData.get('violation_type'),
    title: formData.get('title'),
    description: formData.get('description'),
    observed_date: formData.get('observed_date') || null,
    due_date: formData.get('due_date') || null,
    hearing_date: formData.get('hearing_date') || null,
    status: formData.get('status') || 'open',
    fine_amount: formData.get('fine_amount') ? parseFloat(formData.get('fine_amount') as string) : null,
  };

  const { data, error } = await supabase
    .from('violation_cases')
    .insert(violation)
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create violation:', error);
    return;
  }

  revalidatePath('/violations');
  return { id: data.id };
}
