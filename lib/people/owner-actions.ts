'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function sendOwnerPortalActivation(formData: FormData) {
  const supabase = getServiceClient();
  const ownerId = (formData.get('owner_id') as string)?.trim();
  const subject = (formData.get('subject') as string)?.trim();
  const message = (formData.get('message') as string)?.trim();

  if (!ownerId) redirect('/owners/activations?error=' + encodeURIComponent('Select an owner.'));

  // Get owner with their association → portfolio chain
  const { data: owner } = await supabase
    .from('owners')
    .select('id, full_name, email')
    .eq('id', ownerId)
    .single();

  if (!owner) redirect('/owners/activations?error=' + encodeURIComponent('Owner not found.'));

  // Find the owner's portfolio through unit_owners → units → buildings → associations → portfolios
  const { data: unitOwner } = await supabase
    .from('unit_owners')
    .select('unit_id')
    .eq('owner_id', ownerId)
    .maybeSingle();

  let portfolioId: string | null = null;
  let associationIds: string[] = [];

  if (unitOwner?.unit_id) {
    const { data: unit } = await supabase
      .from('units')
      .select('id, building_id')
      .eq('id', unitOwner.unit_id)
      .single();

    if (unit?.building_id) {
      const { data: building } = await supabase
        .from('buildings')
        .select('id, association_id')
        .eq('id', unit.building_id)
        .single();

      if (building?.association_id) {
        associationIds = [building.association_id];
        const { data: association } = await supabase
          .from('associations')
          .select('id, portfolio_id')
          .eq('id', building.association_id)
          .single();

        portfolioId = association?.portfolio_id ?? null;
      }
    }
  }

  // Fallback: get any portfolio
  if (!portfolioId) {
    const { data: portfolios } = await supabase
      .from('portfolios')
      .select('id')
      .is('archived_at', null)
      .limit(1);
    portfolioId = portfolios?.[0]?.id ?? null;
  }

  if (!portfolioId) redirect('/owners/activations?error=' + encodeURIComponent('No portfolio found.'));

  // Check for existing pending invitation
  const { data: existing } = await supabase
    .from('user_invitations')
    .select('id')
    .eq('email', owner.email)
    .eq('hoa_role', 'homeowner')
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) {
    redirect('/owners/activations?error=' + encodeURIComponent('Invitation already pending for this owner.'));
  }

  // Create invitation
  const { data: invitation, error } = await supabase
    .from('user_invitations')
    .insert({
      portfolio_id: portfolioId,
      email: owner.email,
      full_name: owner.full_name,
      hoa_role: 'homeowner',
      status: 'pending',
      token: crypto.randomUUID(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      association_ids: associationIds,
      metadata: { owner_id: ownerId, template: 'portal_activation' },
      message: `${subject}\n\n${message}`,
    })
    .select('id')
    .single();

  if (error) redirect('/owners/activations?error=' + encodeURIComponent(error.message));

  // Queue email
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
  redirect('/owners/activations?ok=1');
}

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

  if (template === 'portal_activation') {
    const fd = new FormData();
    fd.set('owner_id', ownerId);
    fd.set('subject', subject || 'Activate your owner portal');
    fd.set('message', message || 'Click the link to access your owner portal.');
    return sendOwnerPortalActivation(fd);
  }

  const { data: comm, error } = await supabase
    .from('communication_messages')
    .insert({
      recipient_name: owner.full_name,
      recipient_email: owner.email,
      subject: subject || 'Communication from Stellar Property Management',
      body: message || 'Please review the attached information.',
      channel: 'email',
      status: 'pending',
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
