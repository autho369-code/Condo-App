'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

const TEMPLATES: Record<string, { label: string; docType: string }> = {
  portal_activation: { label: 'Owner portal activation', docType: 'portal_activation' },
  owner_packet: { label: 'Owner onboarding packet', docType: 'owner_packet' },
  ach_authorization: { label: 'ACH authorization', docType: 'ach_authorization' },
  management_agreement: { label: 'Management agreement', docType: 'management_agreement' },
  owner_intake: { label: 'Owner intake form', docType: 'owner_intake' },
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

export async function stageOwnerForm(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const ownerId = req(formData, 'owner_id');
  const templateKey = req(formData, 'template');
  const template = TEMPLATES[templateKey];
  if (!template) return { error: 'Unknown owner form template' };

  const subject = req(formData, 'subject');
  const message = req(formData, 'message');

  const { data: owner, error: ownerError } = await db
    .from('owners')
    .select('id, full_name, email, portfolio_id')
    .eq('id', ownerId)
    .maybeSingle();
  if (ownerError) return { error: ownerError.message };
  if (!owner) return { error: 'Owner not found' };
  if (!owner.email) return { error: 'Owner email is required before a form can be staged' };

  const portfolioId = owner.portfolio_id ?? me.portfolio?.id;
  if (!portfolioId) return { error: 'Portfolio is required before a form can be staged' };

  const { data: occupancy } = await db
    .from('occupancies')
    .select('association_id, unit_id')
    .eq('owner_id', owner.id)
    .eq('status', 'current')
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (templateKey === 'portal_activation') {
    const { error } = await db.rpc('invite_homeowner', {
      p_portfolio_id: portfolioId,
      p_owner_id: owner.id,
      p_email: owner.email,
      p_message: message,
    });
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from('document_requests').insert({
      portfolio_id: portfolioId,
      owner_id: owner.id,
      name: template.label,
      doc_type: template.docType,
      description: subject,
      notes: message,
      requested_by: me.auth_user_id,
      status: 'requested',
    });
    if (error) return { error: error.message };
  }

  const body = `Template: ${template.label}\n\n${message}`;
  const communicationRow = {
    portfolio_id: portfolioId,
    association_id: occupancy?.association_id ?? null,
    channel: 'email',
    status: 'draft',
    recipient_group: 'owner_form',
    recipient_name: owner.full_name,
    recipient_email: owner.email,
    subject,
    body,
    created_by: me.auth_user_id,
  };

  const { error: communicationError } = await db.from('communication_messages').insert(communicationRow);
  if (communicationError) return { error: communicationError.message };

  const { error: emailError } = await db.from('email_queue').insert({
    association_id: occupancy?.association_id ?? null,
    status: 'draft',
    subject,
    body,
    to_email: owner.email,
    to_name: owner.full_name,
    sent_by: me.auth_user_id,
  });
  if (emailError) return { error: emailError.message };

  revalidatePath('/owners/forms');
  revalidatePath('/owners/activations');
  revalidatePath('/owners/ach');
  revalidatePath('/owners/packets');
  revalidatePath('/communication-center');
  redirect(`/owners/forms?owner=${owner.id}&template=${templateKey}&staged=1`);
}
