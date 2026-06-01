'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// ─── Form Types ──────────────────────────────────────────────

export const FORM_TYPES = [
  { key: 'owner_contact', label: 'Owner Contact Form', description: 'Primary contact info, mailing address, phone' },
  { key: 'emergency_contact', label: 'Emergency Contact', description: 'Who to reach in an emergency' },
  { key: 'tenant_info', label: 'Tenant / Rental Information', description: 'Current tenant and lease details' },
  { key: 'vehicle_parking', label: 'Vehicle / Parking', description: 'Vehicles registered to the unit' },
  { key: 'pet_esa', label: 'Pet / ESA / Service Animal', description: 'Animals residing in the unit' },
  { key: 'ach_setup', label: 'ACH / Payment Setup', description: 'Bank draft authorization status' },
  { key: 'management_agreement_intake', label: 'Management Agreement Intake', description: 'Pre-agreement owner details' },
] as const;

export type FormTypeKey = typeof FORM_TYPES[number]['key'];

// ─── Save Form Submission ───────────────────────────────────

export async function saveFormSubmission(formData: FormData) {
  const supabase = await createClient();
  const db = supabase as any;

  const ownerId = String(formData.get('owner_id') || '').trim();
  const formType = String(formData.get('form_type') || '').trim();
  if (!ownerId || !formType) {
    redirect(`/owners/forms?error=${encodeURIComponent('Owner and form type required')}`);
  }

  // Collect all form fields (skip system fields)
  const data: Record<string, any> = {};
  for (const [key, value] of formData.entries()) {
    if (!['owner_id', 'form_type', 'return_to'].includes(key)) {
      data[key] = value;
    }
  }

  // Upsert: one submission per owner per form type
  const { error } = await db
    .from('owner_form_submissions')
    .upsert({
      owner_id: ownerId,
      form_type: formType,
      form_data: data,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,form_type' });

  if (error) {
    redirect(`/owners/forms?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/owners/forms');
  revalidatePath('/owners/[id]');

  const returnTo = String(formData.get('return_to') || '');
  if (returnTo === 'packet') {
    redirect(`/owners/packets/${ownerId}?ok=${encodeURIComponent(formType)}`);
  }
  redirect(`/owners/forms?ok=${encodeURIComponent(formType)}&owner=${ownerId}`);
}

// ─── Get Form Submissions for an Owner ──────────────────────

export async function getOwnerForms(ownerId: string) {
  const supabase = await createClient();
  const db = supabase as any;

  const { data: forms } = await db
    .from('owner_form_submissions')
    .select('id, form_type, status, form_data, submitted_at, updated_at')
    .eq('owner_id', ownerId)
    .order('form_type');

  // Convert to map keyed by form_type
  const formMap: Record<string, any> = {};
  for (const f of (forms || [])) {
    formMap[f.form_type] = f;
  }
  return formMap;
}

// ─── Save Owner Packet ──────────────────────────────────────

export async function saveOwnerPacket(formData: FormData) {
  const supabase = await createClient();
  const db = supabase as any;

  const ownerId = String(formData.get('owner_id') || '').trim();
  if (!ownerId) redirect(`/owners/packets?error=${encodeURIComponent('Owner required')}`);

  const packet = {
    owner_id: ownerId,
    owner_info: JSON.parse(String(formData.get('owner_info') || '{}')),
    unit_info: JSON.parse(String(formData.get('unit_info') || '{}')),
    emergency_contact: JSON.parse(String(formData.get('emergency_contact') || '{}')),
    vehicle_info: JSON.parse(String(formData.get('vehicle_info') || '[]')),
    pet_info: JSON.parse(String(formData.get('pet_info') || '[]')),
    communication_pref: String(formData.get('communication_pref') || 'email'),
    acknowledgments: JSON.parse(String(formData.get('acknowledgments') || '{}')),
    status: String(formData.get('status') || 'draft'),
    submitted_at: formData.get('status') === 'completed' ? new Date().toISOString() : null,
  };

  const { data, error } = await db
    .from('owner_packets')
    .upsert(packet, { onConflict: 'owner_id' })
    .select('id')
    .single();

  if (error) {
    redirect(`/owners/packets?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/owners/packets');
  revalidatePath('/owners/[id]');

  if (packet.status === 'completed') {
    redirect(`/owners/packets?ok=packet_completed&owner=${ownerId}`);
  }
  redirect(`/owners/packets?ok=packet_saved&owner=${ownerId}`);
}

// ─── Sign Management Agreement ──────────────────────────────

export async function signAgreement(agreementId: string, role: 'owner' | 'manager', signature: string) {
  const supabase = await createClient();
  const db = supabase as any;

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

  const { error } = await db
    .from('management_agreements')
    .update(updates)
    .eq('id', agreementId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/owners/agreements');
  return { ok: true };
}

// ─── Send ACH Invite ────────────────────────────────────────

export async function sendACHInvite(ownerId: string) {
  const supabase = await createClient();
  const db = supabase as any;

  const stripeConnected = !!process.env.STRIPE_SECRET_KEY;
  if (!stripeConnected) return { ok: false, error: 'Payment processor not connected' };

  const { data: existing } = await db
    .from('owner_ach_status')
    .select('id, status')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (existing?.status === 'verified') return { ok: false, error: 'ACH already verified' };

  const { error } = await db
    .from('owner_ach_status')
    .upsert({
      owner_id: ownerId,
      status: 'invite_sent',
      invited_at: new Date().toISOString(),
    }, { onConflict: 'owner_id' });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/owners/ach');
  revalidatePath('/owners/[id]');
  return { ok: true };
}
