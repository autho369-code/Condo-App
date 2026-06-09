'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function searchOpenItems(formData: FormData) {
  const supabase = await createClient();
  const bankAccountId = formData.get('bank_account_id');
  const associationId = formData.get('association_id');
  
  let query = (supabase as any).from('charges').select('id, amount, owner_id, unit_id, association_id, description, owners(full_name)').eq('status', 'open').limit(200);
  if (bankAccountId) query = query.eq('bank_account_id', bankAccountId);
  if (associationId) query = query.eq('association_id', associationId);
  
  const { data } = await query;
  revalidatePath('/bank-accounts/deposits/new');
  return data;
}
