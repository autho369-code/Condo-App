'use server';

// Staff-side controls for insurance expiry reminders (30/15-day emails).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';

const FIELDS = ['remind_owner', 'remind_manager'] as const;

export async function toggleReminder(formData: FormData) {
  await requireStaff();
  const policyId = formData.get('policy_id') as string;
  const field = formData.get('field') as string;
  const value = formData.get('value') === '1';
  if (!policyId || !FIELDS.includes(field as any)) {
    redirect('/insurance?error=' + encodeURIComponent('Invalid reminder toggle.'));
  }

  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from('insurance_policies')
    .update({ [field]: value })
    .eq('id', policyId);
  if (error) redirect('/insurance?error=' + encodeURIComponent(error.message));
  revalidatePath('/insurance');
}
