'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'crypto';

// ─── Portal Activation ────────────────────────────────────────────

export async function sendPortalActivation(formData: FormData) {
  const supabase = await createClient();
  const ownerId = String(formData.get('owner_id') || '').trim();
  if (!ownerId) redirect('/owners/activations?error=Select+an+owner');

  const { data: owner } = await (supabase as any)
    .from('owners').select('id, full_name, email').eq('id', ownerId).single();
  if (!owner) redirect('/owners/activations?error=Owner+not+found');

  // Upsert invite
  const { error } = await (supabase as any)
    .from('owner_portal_invites')
    .upsert({
      owner_id: ownerId,
      email: owner.email,
      status: 'sent',
      token: randomUUID(),
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'owner_id' });

  if (error) redirect('/owners/activations?error=' + encodeURIComponent(error.message));

  revalidatePath('/owners/activations');
  revalidatePath('/owners/[id]');
  redirect('/owners/activations?ok=Invitation+sent');
}

// ─── Owner Packet ─────────────────────────────────────────────────

export async function saveOwnerPacket(formData: FormData) {
  const supabase = await createClient();
  const ownerId = String(formData.get('owner_id') || '').trim();
  if (!ownerId) return { ok: false, error: 'Select an owner' };

  const packet = {
    owner_id: ownerId,
    owner_info: JSON.parse(String(formData.get('owner_info') || '{}')),
    unit_info: JSON.parse(String(formData.get('unit_info') || '{}')),
    emergency_contact: JSON.parse(String(formData.get('emergency_contact') || '{}')),
    vehicle_info: JSON.parse(String(formData.get('vehicle_info') || '[]')),
    pet_info: JSON.parse(String(formData.get('pet_info') || '[]')),
    communication_pref: String(formData.get('communication_pref') || 'email'),
    acknowledgments: JSON.parse(String(formData.get('acknowledgments') || '{}')),
    status: 'completed',
    submitted_at: new Date().toISOString(),
  };

  const { data, error } = await (supabase as any)
    .from('owner_packets')
    .upsert(packet, { onConflict: 'owner_id' })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/owners/forms');
  return { ok: true, id: data.id };
}

// ─── Owner Forms ───────────────────────────────────────────────────

export async function submitOwnerForm(formData: FormData) {
  const supabase = await createClient();
  const ownerId = String(formData.get('owner_id') || '').trim();
  const formType = String(formData.get('form_type') || '').trim();
  if (!ownerId || !formType) return { ok: false, error: 'Missing owner or form type' };

  const formDataRaw: Record<string, any> = {};
  formData.forEach((value, key) => {
    if (!['owner_id', 'form_type'].includes(key)) {
      formDataRaw[key] = value;
    }
  });

  const { data, error } = await (supabase as any)
    .from('owner_form_submissions')
    .insert({
      owner_id: ownerId,
      form_type: formType,
      form_data: formDataRaw,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/owners/[id]');
  return { ok: true, id: data.id };
}

// ─── ACH Status ────────────────────────────────────────────────────

export async function updateACHStatus(ownerId: string, status: string, error?: string) {
  const supabase = await createClient();
  const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };

  if (status === 'invite_sent') updates.invited_at = new Date().toISOString();
  if (status === 'completed') updates.completed_at = new Date().toISOString();
  if (status === 'verified') updates.verified_at = new Date().toISOString();
  if (error) updates.last_error = error;

  const { error: dbError } = await (supabase as any)
    .from('owner_ach_status')
    .upsert({ owner_id: ownerId, ...updates }, { onConflict: 'owner_id' });

  if (dbError) return { ok: false, error: dbError.message };
  revalidatePath('/owners/[id]');
  return { ok: true };
}

export async function sendACHInvite(formData: FormData) {
  const ownerId = String(formData.get('owner_id') || '').trim();
  if (!ownerId) redirect('/owners/forms?error=Select+an+owner');
  const result = await updateACHStatus(ownerId, 'invite_sent');
  if (!result.ok) redirect('/owners/forms?error=' + encodeURIComponent(result.error || 'Failed'));
  redirect('/owners/forms?ok=ACH+invite+sent');
}

// ─── Management Agreement ──────────────────────────────────────────

export async function saveManagementAgreement(formData: FormData) {
  const supabase = await createClient();
  const ownerId = String(formData.get('owner_id') || '').trim();
  if (!ownerId) return { ok: false, error: 'Select an owner' };

  const agreement = {
    owner_id: ownerId,
    unit_id: String(formData.get('unit_id') || '').trim() || null,
    agreement_data: {
      management_fee: String(formData.get('management_fee') || ''),
      lease_fee: String(formData.get('lease_fee') || ''),
      renewal_fee: String(formData.get('renewal_fee') || ''),
      term_months: Number(formData.get('term_months') || 12),
      services: String(formData.get('services') || ''),
      special_terms: String(formData.get('special_terms') || ''),
    },
    status: 'draft',
  };

  const { data, error } = await (supabase as any)
    .from('management_agreements')
    .insert(agreement)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/owners/[id]');
  return { ok: true, id: data.id };
}

export async function signAgreement(agreementId: string, role: 'owner' | 'manager', signature: string) {
  const supabase = await createClient();
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };

  if (role === 'owner') {
    updates.owner_signed_at = new Date().toISOString();
    updates.owner_signature = signature;
    updates.status = 'signed_by_owner';
  } else {
    updates.manager_signed_at = new Date().toISOString();
    updates.manager_signature = signature;
    updates.status = 'active';
  }

  const { error } = await (supabase as any)
    .from('management_agreements')
    .update(updates)
    .eq('id', agreementId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/owners/[id]');
  return { ok: true };
}
