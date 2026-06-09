'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createAdjustment(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from('bank_adjustments').insert({
    bank_account_id: formData.get('bank_account_id') || null,
    amount: parseFloat(formData.get('amount') as string) || 0,
    adjustment_date: formData.get('adjustment_date') || null,
    description: formData.get('description') || '',
  });
  if (error) { console.error('Failed to create adjustment:', error); return; }
  revalidatePath('/bank-accounts');
}
