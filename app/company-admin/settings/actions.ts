'use server';

import { createClient } from '@/lib/supabase/server';
import { requireCompanyAdmin } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';

export async function saveCompanySettings(formData: FormData) {
  'use server';

  const me = await requireCompanyAdmin();
  const supabase = await createClient();
  const db = supabase as any;
  const portfolioId = me.portfolio?.id;

  if (!portfolioId) {
    throw new Error('No portfolio assigned.');
  }

  // Extract form fields
  const officeAddress = formData.get('office_address') as string;
  const officeCity = formData.get('office_city') as string;
  const officeState = formData.get('office_state') as string;
  const officeZip = formData.get('office_zip') as string;
  const phone = formData.get('phone') as string;
  const billingEmail = formData.get('billing_email') as string;
  const logoUrl = formData.get('logo_url') as string;

  // Notification toggles
  const emailNotifications = formData.get('email_notifications') === 'on';
  const smsNotifications = formData.get('sms_notifications') === 'on';
  const woNotifications = formData.get('wo_notifications') === 'on';
  const violationNotifications = formData.get('violation_notifications') === 'on';
  const paymentNotifications = formData.get('payment_notifications') === 'on';
  const architecturalNotifications = formData.get('architectural_notifications') === 'on';

  // Manager permission defaults (JSONB)
  const canManageAssociations = formData.get('can_manage_associations') === 'on';
  const canManageOwners = formData.get('can_manage_owners') === 'on';
  const canManageVendors = formData.get('can_manage_vendors') === 'on';
  const canManageWorkOrders = formData.get('can_manage_work_orders') === 'on';
  const canManageViolations = formData.get('can_manage_violations') === 'on';
  const canManageBilling = formData.get('can_manage_billing') === 'on';

  // Owner invite defaults (JSONB)
  const ownerPortalAccess = formData.get('owner_portal_access') === 'on';
  const ownerEmailInvite = formData.get('owner_email_invite') === 'on';
  const ownerSmsInvite = formData.get('owner_sms_invite') === 'on';

  // Vendor invite defaults (JSONB)
  const vendorPortalAccess = formData.get('vendor_portal_access') === 'on';
  const vendorEmailInvite = formData.get('vendor_email_invite') === 'on';

  const notificationDefaults = {
    email: emailNotifications,
    sms: smsNotifications,
    work_orders: woNotifications,
    violations: violationNotifications,
    payments: paymentNotifications,
    architectural: architecturalNotifications,
  };

  const managerPermissionDefaults = {
    can_manage_associations: canManageAssociations,
    can_manage_owners: canManageOwners,
    can_manage_vendors: canManageVendors,
    can_manage_work_orders: canManageWorkOrders,
    can_manage_violations: canManageViolations,
    can_manage_billing: canManageBilling,
  };

  const ownerInviteDefaults = {
    portal_access: ownerPortalAccess,
    email_invite: ownerEmailInvite,
    sms_invite: ownerSmsInvite,
  };

  const vendorInviteDefaults = {
    portal_access: vendorPortalAccess,
    email_invite: vendorEmailInvite,
  };

  const branding = {
    logo_url: logoUrl || null,
  };

  // Check if settings row exists
  const { data: existing } = await db
    .from('company_settings')
    .select('id')
    .eq('portfolio_id', portfolioId)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from('company_settings')
      .update({
        office_address: officeAddress || null,
        office_city: officeCity || null,
        office_state: officeState || null,
        office_zip: officeZip || null,
        phone: phone || null,
        billing_email: billingEmail || null,
        notification_defaults: notificationDefaults as any,
        manager_permission_defaults: managerPermissionDefaults as any,
        owner_invite_defaults: ownerInviteDefaults as any,
        vendor_invite_defaults: vendorInviteDefaults as any,
        branding: branding as any,
      } as any)
      .eq('id', existing.id);

    if (error) {
      throw new Error(`Failed to update settings: ${error.message}`);
    }
  } else {
    const { error } = await db
      .from('company_settings')
      .insert({
        portfolio_id: portfolioId,
        office_address: officeAddress || null,
        office_city: officeCity || null,
        office_state: officeState || null,
        office_zip: officeZip || null,
        phone: phone || null,
        billing_email: billingEmail || null,
        notification_defaults: notificationDefaults as any,
        manager_permission_defaults: managerPermissionDefaults as any,
        owner_invite_defaults: ownerInviteDefaults as any,
        vendor_invite_defaults: vendorInviteDefaults as any,
        branding: branding as any,
      } as any);

    if (error) {
      throw new Error(`Failed to create settings: ${error.message}`);
    }
  }

  revalidatePath('/company-admin/settings');
}
