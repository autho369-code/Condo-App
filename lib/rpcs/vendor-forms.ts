'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const TEMPLATES: Record<string, { label: string; docType: string }> = {
  vendor_intake: { label: 'Vendor intake form', docType: 'vendor_intake' },
  vendor_bank_account: { label: 'Vendor bank account information', docType: 'vendor_bank_account' },
  w9_request: { label: 'W-9 request', docType: 'w9' },
  document_request: { label: 'Insurance / license document request', docType: 'compliance_document' },
};

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
};

const req = (formData: FormData, key: string) => {
  const value = str(formData, key);
  if (!value) throw new Error(`${key} is required`);
  return value;
};

function firstEmail(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.includes('@')) return item;
      if (item && typeof item === 'object') {
        const record = item as { value?: string; email?: string };
        const email = record.email ?? record.value;
        if (email?.includes('@')) return email;
      }
    }
  }
  return typeof value === 'string' && value.includes('@') ? value : null;
}

export async function stageVendorForm(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const vendorId = req(formData, 'vendor_id');
  const templateKey = req(formData, 'template');
  const template = TEMPLATES[templateKey];
  if (!template) return { error: 'Unknown vendor form template' };

  const subject = req(formData, 'subject');
  const message = req(formData, 'message');

  const { data: vendor, error: vendorError } = await db
    .from('vendors')
    .select('id, name, emails, portfolio_id')
    .eq('id', vendorId)
    .maybeSingle();
  if (vendorError) return { error: vendorError.message };
  if (!vendor) return { error: 'Vendor not found' };

  const email = firstEmail(vendor.emails);
  if (!email) return { error: 'Vendor email is required before a form can be staged' };

  const { error: requestError } = await db.from('document_requests').insert({
    portfolio_id: vendor.portfolio_id,
    vendor_id: vendor.id,
    name: template.label,
    doc_type: template.docType,
    description: subject,
    notes: message,
    requested_by: me.auth_user_id,
    status: 'requested',
  });
  if (requestError) return { error: requestError.message };

  const body = `Template: ${template.label}\n\n${message}`;

  const { error: communicationError } = await db.from('communication_messages').insert({
    portfolio_id: vendor.portfolio_id,
    channel: 'email',
    status: 'draft',
    recipient_group: 'vendor_form',
    recipient_name: vendor.name,
    recipient_email: email,
    subject,
    body,
    created_by: me.auth_user_id,
  });
  if (communicationError) return { error: communicationError.message };

  const { error: emailError } = await db.from('email_queue').insert({
    status: 'draft',
    subject,
    body,
    to_email: email,
    to_name: vendor.name,
    sent_by: me.auth_user_id,
  });
  if (emailError) return { error: emailError.message };

  revalidatePath('/vendors/forms');
  revalidatePath('/vendors/w9');
  revalidatePath('/vendors/compliance');
  revalidatePath('/vendors/ach');
  revalidatePath('/communication-center');
  redirect(`/vendors/forms?vendor=${vendor.id}&template=${templateKey}&staged=1`);
}
