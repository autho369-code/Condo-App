'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function failTo(message: string): never {
  redirect(`/company-admin/settings?error=${encodeURIComponent(message)}`)
}

export async function updateCompanySettings(formData: FormData) {
  const me = await requirePortfolioAdmin()
  const supabase = await createClient()
  const db = supabase as any
  const portfolioId = me.portfolio.id

  const companyName = formData.get('company_name') as string
  const logoUrl = formData.get('logo_url') as string
  const addressStreet = formData.get('address_street') as string
  const addressCity = formData.get('address_city') as string
  const addressState = formData.get('address_state') as string
  const addressZip = formData.get('address_zip') as string
  const phoneNumber = formData.get('phone_number') as string
  const billingEmail = formData.get('billing_email') as string
  const officePhone = formData.get('office_phone') as string
  const officeAddress = formData.get('office_address') as string
  const brandingEnabled = formData.get('branding_enabled') === 'on'

  // Notification prefs (checkboxes)
  const notificationPrefs = {
    new_association: formData.get('notify_new_association') === 'on',
    delinquency_alert: formData.get('notify_delinquency') === 'on',
    work_order_update: formData.get('notify_work_order') === 'on',
    violation_reported: formData.get('notify_violation') === 'on',
    billing_reminder: formData.get('notify_billing') === 'on',
  }

  // Manager defaults
  const managerDefaults = {
    role: (formData.get('default_role') as string) || 'manager',
    permissions: (formData.get('default_permissions') as string) || 'standard',
  }

  // Update portfolios table
  const portfolioUpdate: Record<string, any> = {
    company_name: companyName,
    phone_number: phoneNumber || null,
    address_street: addressStreet || null,
    address_city: addressCity || null,
    address_state: addressState || null,
    address_zip: addressZip || null,
  }

  const { error: portfolioError } = await db
    .from('portfolios')
    .update(portfolioUpdate)
    .eq('id', portfolioId)

  if (portfolioError) failTo(`Failed to update company profile: ${portfolioError.message}`)

  // Upsert portfolio_settings
  const settingsPayload: Record<string, any> = {
    portfolio_id: portfolioId,
    logo_url: logoUrl || null,
    office_address: officeAddress || null,
    office_phone: officePhone || null,
    billing_email: billingEmail || null,
    notification_prefs: notificationPrefs,
    manager_defaults: managerDefaults,
    branding_enabled: brandingEnabled,
  }

  // Check if settings row exists
  const { data: existingSettings } = await db
    .from('portfolio_settings')
    .select('id')
    .eq('portfolio_id', portfolioId)
    .maybeSingle()

  if (existingSettings?.id) {
    const { error: settingsError } = await db
      .from('portfolio_settings')
      .update(settingsPayload)
      .eq('id', existingSettings.id)
    if (settingsError) failTo(`Failed to update settings: ${settingsError.message}`)
  } else {
    const { error: insertError } = await db
      .from('portfolio_settings')
      .insert(settingsPayload)
    if (insertError) failTo(`Failed to save settings: ${insertError.message}`)
  }

  revalidatePath('/company-admin/settings')
  redirect('/company-admin/settings?saved=1')
}
