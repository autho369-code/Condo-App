'use server';
import { createClient } from '@/lib/supabase/server';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function updatePortfolioPolicy(portfolioId: string, formData: FormData) {
  // In-action guard + scope: policy edits (late fees, MFA requirements,
  // convenience fees) always target the CALLER's portfolio — the bound
  // parameter is ignored in favor of the session's portfolio.
  const me = await requirePortfolioAdmin();
  // Bound arguments come from the client: never fall back to it.
  void portfolioId;
  const ownPortfolioId: string | undefined = me.portfolio?.id;
  if (!ownPortfolioId) redirect('/settings?error=' + encodeURIComponent('Your account is not linked to a company.'));
  const supabase = await createClient();

  // Company name is what every client-facing page, email and document shows:
  // never store a blank or whitespace-only one.
  const companyName = formData.has('company_name')
    ? String(formData.get('company_name') ?? '').trim().slice(0, 200)
    : null;
  if (companyName === '') redirect('/settings?error=' + encodeURIComponent('Company name is required.'));

  const reminderDays = (formData.get('reminder_days') as string || '14,7,1,-7,-30')
    .split(',').map((s) => parseInt(s.trim())).filter((n) => !Number.isNaN(n));

  const { data: saved, error } = await (supabase as any).from('portfolios').update({
    ...(companyName ? { company_name: companyName } : {}),
    phone_number:                     (formData.get('phone_number') as string) || null,
    texting_phone_number:             (formData.get('texting_phone_number') as string) || null,
    default_nsf_fee_amount:           parseFloat(formData.get('nsf_fee_amount') as string) || 0,
    default_payment_reminder_days:    reminderDays,
    statement_generation_day:         parseInt(formData.get('statement_generation_day') as string) || 1,
    fiscal_year_start_month:          parseInt(formData.get('fiscal_year_start_month') as string) || 1,
    require_mfa_for_admins:           formData.get('require_mfa_for_admins') === 'on',
    require_mfa_for_staff:            formData.get('require_mfa_for_staff') === 'on',
    convenience_fee_mode:             formData.get('convenience_fee_mode') as any,
    convenience_fee_card_pct:         parseFloat(formData.get('convenience_fee_card_pct') as string) || 0,
    // The settings form has no late-fee inputs; only write them when posted,
    // otherwise every save silently reset the default late fee to $0.
    ...(formData.has('late_fee_amount')
      ? { default_late_fee_amount: parseFloat(formData.get('late_fee_amount') as string) || 0 }
      : {}),
    ...(formData.has('late_fee_grace_days')
      ? { default_late_fee_grace_days: Math.max(0, parseInt(formData.get('late_fee_grace_days') as string) || 0) }
      : {}),
  }).eq('id', ownPortfolioId).select('id');

  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  if (!saved?.length) redirect('/settings?error=' + encodeURIComponent('Settings were not saved: your account cannot edit this company.'));
  revalidatePath('/settings');
}
