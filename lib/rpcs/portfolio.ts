'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

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

  if (error) return { error: error.message };
  revalidatePath('/settings');
}

/**
 * Update brand identity (logo URL, address, contact, website, brand emails).
 * Called from /settings/branding by portfolio admins. RLS scopes the row.
 */
export async function updatePortfolioBranding(portfolioId: string, formData: FormData) {
  'use server';
  const supabase = await createClient();

  const updates: Record<string, any> = {
    company_name:       (formData.get('company_name')       as string)?.trim() || null,
    address_street:     (formData.get('address_street')     as string)?.trim() || null,
    address_city:       (formData.get('address_city')       as string)?.trim() || null,
    address_state:      (formData.get('address_state')      as string)?.trim() || null,
    address_zip:        (formData.get('address_zip')        as string)?.trim() || null,
    phone_number:       (formData.get('phone_number')       as string)?.trim() || null,
    brand_email:        ((formData.get('brand_email')       as string) ?? '').trim().toLowerCase() || null,
    billing_email_from: ((formData.get('billing_email_from') as string) ?? '').trim().toLowerCase() || null,
    website:            (formData.get('website')            as string)?.trim() || null,
  };

  // logo_url + favicon_url come from client-side upload components — only update
  // when the hidden field is populated, or when an explicit clear flag was set.
  const logoUrl = (formData.get('logo_url') as string)?.trim();
  if (logoUrl) updates.logo_url = logoUrl;
  if (formData.get('clear_logo') === '1') updates.logo_url = null;

  const faviconUrl = (formData.get('favicon_url') as string)?.trim();
  if (faviconUrl) updates.favicon_url = faviconUrl;
  if (formData.get('clear_favicon') === '1') updates.favicon_url = null;

  const { error } = await (supabase as any)
    .from('portfolios')
    .update(updates)
    .eq('id', portfolioId);

  if (error) return { error: error.message };
  revalidatePath('/settings');
  revalidatePath('/settings/branding');
  // Branding shows on auth + portal layouts too — bust the layout cache
  revalidatePath('/', 'layout');
}
