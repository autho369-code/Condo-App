'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Service-role client bypasses RLS — required because the RLS policies
// on user_invitations create recursion with platform_operators.
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Send portal activation email immediately — no staging.
 */
export async function sendOwnerPortalActivation(formData: FormData) {
  const supabase = getServiceClient();
  const ownerId = (formData.get('owner_id') as string)?.trim();
  const subject = (formData.get('subject') as string)?.trim();
  const message = (formData.get('message') as string)?.trim();

  if (!ownerId) redirect('/owners/activations?error=' + encodeURIComponent('Select an owner.'));

  const { data: owner } = await supabase
    .from('owners')
    .select('id, full_name, email')
    .eq('id', ownerId)
    .single();

  if (!owner) redirect('/owners/activations?error=' + encodeURIComponent('Owner not found.'));

  // Check for existing active invitation
  const { data: existing } = await supabase
    .from('user_invitations')
    .select('id, status')
    .eq('email', owner.email)
    .eq('role', 'homeowner')
    .in('status', ['sent'])
    .maybeSingle();

  if (existing) {
    redirect('/owners/activations?error=' + encodeURIComponent('An active invitation already exists for this owner.'));
  }

  // Create invitation as SENT immediately
  const { data: invitation, error } = await supabase
    .from('user_invitations')
    .insert({
      email: owner.email,
      full_name: owner.full_name,
      role: 'homeowner',
      status: 'sent',
      message: `${subject}\n\n${message}`,
      metadata: { owner_id: ownerId, template: 'portal_activation' },
    })
    .select('id')
    .single();

  if (error) redirect('/owners/activations?error=' + encodeURIComponent(error.message));

  // Queue email for delivery
  await supabase.from('email_queue').insert({
    to_address: owner.email,
    to_name: owner.full_name,
    subject: subject || 'Activate your owner portal',
    body: message || 'Click the link to activate your owner portal account.',
    template: 'portal_activation',
    reference_type: 'user_invitation',
    reference_id: invitation.id,
    status: 'queued',
  });

  revalidatePath('/owners/activations');
  revalidatePath('/owners/forms');
  redirect('/owners/activations?ok=1');
}

/**
 * Send a form/communication to an owner immediately.
 */
export async function sendOwnerForm(formData: FormData) {
  const supabase = getServiceClient();
  const ownerId = (formData.get('owner_id') as string)?.trim();
  const template = (formData.get('template') as string)?.trim() || 'owner_intake';
  const subject = (formData.get('subject') as string)?.trim();
  const message = (formData.get('message') as string)?.trim();

  if (!ownerId) redirect('/owners/forms?error=' + encodeURIComponent('Select an owner.'));

  const { data: owner } = await supabase
    .from('owners')
    .select('id, full_name, email')
    .eq('id', ownerId)
    .single();

  if (!owner) redirect('/owners/forms?error=' + encodeURIComponent('Owner not found.'));

  // If portal activation, use that flow
  if (template === 'portal_activation') {
    const fd = new FormData();
    fd.set('owner_id', ownerId);
    fd.set('subject', subject || 'Activate your owner portal');
    fd.set('message', message || 'Click the link to access your owner portal.');
    return sendOwnerPortalActivation(fd);
  }

  // Create communication immediately
  const { data: comm, error } = await supabase
    .from('communication_messages')
    .insert({
      recipient_name: owner.full_name,
      recipient_email: owner.email,
      subject: subject || 'Communication from Stellar Property Management',
      body: message || 'Please review the attached information.',
      channel: 'email',
      status: 'sent',
      template: template,
      metadata: { owner_id: ownerId },
    })
    .select('id')
    .single();

  if (error) redirect('/owners/forms?error=' + encodeURIComponent(error.message));

  await supabase.from('email_queue').insert({
    to_address: owner.email,
    to_name: owner.full_name,
    subject: subject || 'Communication from Stellar Property Management',
    body: message || 'Please review the attached information.',
    template: template,
    reference_type: 'communication_message',
    reference_id: comm.id,
    status: 'queued',
  });

  revalidatePath('/owners/forms');
  redirect('/owners/forms?ok=1');
}
