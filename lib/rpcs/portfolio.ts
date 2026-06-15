'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function updatePortfolioPolicy(portfolioId: string, formData: FormData) {
  const supabase = await createClient();

  const reminderDays = (formData.get('reminder_days') as string || '14,7,1,-7,-30')
    .split(',').map((s) => parseInt(s.trim())).filter((n) => !Number.isNaN(n));

  const { error } = await (supabase as any).from('portfolios').update({
    company_name:                     formData.get('company_name') as string,
    phone_number:                     (formData.get('phone_number') as string) || null,
    texting_phone_number:             (formData.get('texting_phone_number') as string) || null,
    default_late_fee_amount:          parseFloat(formData.get('late_fee_amount') as string) || 0,
    default_late_fee_grace_days:      parseInt(formData.get('late_fee_grace_days') as string) || 10,
    default_nsf_fee_amount:           parseFloat(formData.get('nsf_fee_amount') as string) || 0,
    default_payment_reminder_days:    reminderDays,
    statement_generation_day:         parseInt(formData.get('statement_generation_day') as string) || 1,
    fiscal_year_start_month:          parseInt(formData.get('fiscal_year_start_month') as string) || 1,
    require_mfa_for_admins:           formData.get('require_mfa_for_admins') === 'on',
    require_mfa_for_staff:            formData.get('require_mfa_for_staff') === 'on',
    convenience_fee_mode:             formData.get('convenience_fee_mode') as any,
    convenience_fee_card_pct:         parseFloat(formData.get('convenience_fee_card_pct') as string) || 0,
  }).eq('id', portfolioId);

  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath('/settings');
}
