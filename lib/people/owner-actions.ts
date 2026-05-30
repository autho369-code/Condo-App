'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Stage a portal activation email for an owner.
 * Saves to user_invitations + email_queue, requires explicit confirmation.
 */
export async function sendOwnerPortalActivation(formData: FormData) {
  const supabase = await createClient();
  const ownerId = (formData.get('owner_id') as string)?.trim();
  const subject = (formData.get('subject') as string)?.trim();
  const message = (formData.get('message') as string)?.trim();

  if (!ownerId) redirect('/owners/activations?error=' + encodeURIComponent('Select an owner.'));

  // Get the owner details
  const { data: owner } = await (supabase as any)
    .from('owners')
    .select('id, full_name, email')
    .eq('id', ownerId)
    .single();

  if (!owner) redirect('/owners/activations?error=' + encodeURIComponent('Owner not found.'));

  // Check for existing pending invitation
  const { data: existing } = await (supabase as any)
    .from('user_invitations')
    .select('id, status')
    .eq('email', owner.email)
    .eq('role', 'homeowner')
    .in('status', ['sent', 'staged'])
    .maybeSingle();

  if (existing) {
    redirect('/owners/activations?error=' + encodeURIComponent('An invitation is already staged or sent for this owner.'));
  }

  // Create the invitation record
  const { data: invitation, error } = await (supabase as any)
    .from('user_invitations')
    .insert({
      email: owner.email,
      full_name: owner.full_name,
      role: 'homeowner',
      status: 'staged',
      message: `${subject}\n\n${message}`,
      metadata: { owner_id: ownerId, template: 'portal_activation', staged_by: 'staff' },
    })
    .select('id')
    .single();

  if (error) redirect('/owners/activations?error=' + encodeURIComponent(error.message));

  // Queue the email
  await (supabase as any).from('email_queue').insert({
    to_address: owner.email,
    to_name: owner.full_name,
    subject: subject || 'Activate your owner portal',
    body: message || 'Please click the link below to activate your owner portal account.',
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
 * Confirm and send a staged invitation.
 */
export async function confirmOwnerInvitation(formData: FormData) {
  const supabase = await createClient();
  const invitationId = (formData.get('invitation_id') as string)?.trim();

  if (!invitationId) redirect('/owners/activations?error=' + encodeURIComponent('No invitation selected.'));

  const { error } = await (supabase as any)
    .from('user_invitations')
    .update({ status: 'sent', updated_at: new Date().toISOString() })
    .eq('id', invitationId);

  if (error) redirect('/owners/activations?error=' + encodeURIComponent(error.message));

  // Trigger email send
  await (supabase as any).from('email_queue').update({ status: 'queued' })
    .eq('reference_id', invitationId)
    .eq('reference_type', 'user_invitation');

  revalidatePath('/owners/activations');
  redirect('/owners/activations?ok=1');
}

/**
 * Send a form/communication to an owner (portal activation, owner packet, etc.)
 */
export async function sendOwnerForm(formData: FormData) {
  const supabase = await createClient();
  const ownerId = (formData.get('owner_id') as string)?.trim();
  const template = (formData.get('template') as string)?.trim() || 'owner_intake';
  const subject = (formData.get('subject') as string)?.trim();
  const message = (formData.get('message') as string)?.trim();

  if (!ownerId) redirect('/owners/forms?error=' + encodeURIComponent('Select an owner.'));

  const { data: owner } = await (supabase as any)
    .from('owners')
    .select('id, full_name, email')
    .eq('id', ownerId)
    .single();

  if (!owner) redirect('/owners/forms?error=' + encodeURIComponent('Owner not found.'));

  // If this is a portal activation, reuse the activation flow
  if (template === 'portal_activation') {
    // Create pseudo-FormData to reuse the activation function
    const activationData = new FormData();
    activationData.set('owner_id', ownerId);
    activationData.set('subject', subject || 'Activate your owner portal');
    activationData.set('message', message || 'Click the link to access your owner portal.');
    return sendOwnerPortalActivation(activationData);
  }

  // For other templates, queue as a general communication
  const { data: comm, error } = await (supabase as any)
    .from('communication_messages')
    .insert({
      recipient_name: owner.full_name,
      recipient_email: owner.email,
      subject: subject || 'Communication from Stellar Property Management',
      body: message || 'Please review the attached information.',
      channel: 'email',
      status: 'staged',
      template: template,
      metadata: { owner_id: ownerId },
    })
    .select('id')
    .single();

  if (error) redirect('/owners/forms?error=' + encodeURIComponent(error.message));

  await (supabase as any).from('email_queue').insert({
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
