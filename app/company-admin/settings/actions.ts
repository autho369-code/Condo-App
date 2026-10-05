'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { normalizeCompanyLogoUrl } from '@/lib/company-admin/settings'

function failTo(message: string): never {
  redirect(`/company-admin/settings?error=${encodeURIComponent(message)}`)
}

export async function updateCompanySettings(formData: FormData) {
  const me = await requirePortfolioAdmin()
  const portfolioId: string | undefined = me.portfolio?.id
  if (!portfolioId) failTo('Your account is not linked to a company.')
  const supabase = await createClient()
  const db = supabase as any

  const normalized = normalizeCompanyLogoUrl(formData.get('logo_url'))
  if ('error' in normalized) failTo(normalized.error)
  const { logoUrl } = normalized as { logoUrl: string | null }

  // Both RPCs act on current_portfolio_id() server-side and re-check the
  // caller's role, so no formData-supplied id is trusted. A direct update on
  // portfolios matches 0 rows for company admins (RLS), so writes go through
  // these SECURITY DEFINER functions.
  const brandColor = (formData.get('brand_color') as string) || null
  const { error: portfolioError } = await db.rpc('update_company_profile', {
    p_company_name: formData.get('company_name') as string,
    p_phone_number: (formData.get('phone_number') as string) || null,
    p_address_street: (formData.get('address_street') as string) || null,
    p_address_city: (formData.get('address_city') as string) || null,
    p_address_state: (formData.get('address_state') as string) || null,
    p_address_zip: (formData.get('address_zip') as string) || null,
    p_support_email: (formData.get('support_email') as string) || null,
    p_brand_color: brandColor,
  })
  if (portfolioError) failTo(`Failed to update company profile: ${portfolioError.message}`)

  // The logo lives on portfolios.logo_url — the column the sidebar, portals
  // and tenant branding read (portfolio_settings.logo_url was never read).
  const { error: logoError } = await db.rpc('update_company_logo', { p_logo_url: logoUrl })
  if (logoError) failTo(`Failed to update logo: ${logoError.message}`)

  revalidatePath('/company-admin/settings')
  revalidatePath('/company-admin', 'layout')
  redirect('/company-admin/settings?saved=1')
}
