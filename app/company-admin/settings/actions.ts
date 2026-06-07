'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePortfolioAdmin } from '@/lib/auth/me'
import { revalidatePath } from 'next/cache'

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
  const supportEmail = formData.get('support_email') as string
  const billingEmail = formData.get('billing_email') as string
  const brandColor = formData.get('brand_color') as string
  const officePhone = formData.get('office_phone') as string
  const officeAddress = formData.get('office_address') as string
  const brandingEnabled = formData.get('branding_enabled') === 'on'

  // Notification prefs (checkboxes)
  const notifyNewAssociation = formData.get('notify_new_association') === 'on'
  const notifyDelinquency = formData.get('notify_delinquency') === 'on'
  const notifyWorkOrder = formData.get('notify_work_order') === 'on'
  const notifyViolation = formData.get('notify_violation') === 'on'
  const notifyBilling = formData.get('notify_billing') === 'on'

  // Manager defaults
  const defaultRole = formData.get('default_role') as string
  const defaultPermissions = formData.get('default_permissions') as string

  const notificationPrefs = {
    new_association: notifyNewAssociation,
    delinquency_alert: notifyDelinquency,
    work_order_update: notifyWorkOrder,
    violation_reported: notifyViolation,
    billing_reminder: notifyBilling,
  }

  let managerDefaults: Record<string, any> = {}
  try {
    managerDefaults = {
      role: defaultRole || 'manager',
      permissions: defaultPermissions || 'standard',
    }
  } catch {
    managerDefaults = { role: 'manager', permissions: 'standard' }
  }

  try {
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

    if (portfolioError) {
      console.error('Failed to update portfolio:', portfolioError.message)
      return
    }

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
      if (settingsError) {
        console.error('Failed to update settings:', settingsError.message)
        return
      }
    } else {
      // Try insert
      try {
        const { error: insertError } = await db
          .from('portfolio_settings')
          .insert(settingsPayload)
        if (insertError) {
          // If table doesn't exist, just skip
          console.warn('portfolio_settings insert failed:', insertError.message)
        }
      } catch {
        // Table may not exist — that's ok
      }
    }

    revalidatePath('/company-admin/settings')
    return
  } catch (err: any) {
    console.error('Settings update failed:', err?.message)
    return
  }
}
