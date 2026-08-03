'use server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { safeInternalNext } from '@/lib/security/redirects';
import { canonicalPhone, smsDeliveryConfigured } from '@/lib/sms/twilio';

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
};
const req = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!v) throw new Error(`${k} is required`);
  return v;
};

/** Send an SMS via the sms_messages + sms_conversations tables. */
export async function sendSms(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const failTo = (msg: string) => {
    const base = safeInternalNext(str(formData, 'return_to')) ?? '/sms';
    redirect(`${base}${base.includes('?') ? '&' : '?'}error=${encodeURIComponent(msg)}`);
  };

  const recipientType = req(formData, 'recipient_type');
  if (!['owner', 'vendor'].includes(recipientType)) { failTo('SMS recipients must be an owner or vendor.'); return; }
  const recipientId = req(formData, 'recipient_id');
  const phoneNumber = canonicalPhone(req(formData, 'phone_number'));
  const body = req(formData, 'message');
  const fromNumber = str(formData, 'from_number') ?? me.portfolio?.phone_number ?? '+10000000000';
  if (!smsDeliveryConfigured()) { failTo('Live SMS delivery is not configured for this environment.'); return; }

  // Consent is a delivery prerequisite, not a warning. The provider worker
  // never receives messages that did not pass this portfolio-scoped check.
  const { data: consent } = await db
    .from('sms_opt_ins')
    .select('id, opted_in')
    .eq('portfolio_id', me.portfolio?.id)
    .eq('phone_number', phoneNumber)
    .eq('opted_in', true)
    .maybeSingle();
  if (!consent) { failTo('This phone number does not have active SMS consent.'); return; }

  const { data: entity } = recipientType === 'owner'
    ? await db.from('owners').select('full_name, phone, phone_numbers').eq('id', recipientId).maybeSingle()
    : await db.from('vendors').select('name, phone_numbers').eq('id', recipientId).maybeSingle();
  if (!entity) { failTo('Select an accessible owner or vendor.'); return; }
  const entityPhones = [entity.phone, ...(Array.isArray(entity.phone_numbers) ? entity.phone_numbers.map((entry: any) => entry?.number) : [])]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(canonicalPhone);
  if (!entityPhones.includes(phoneNumber)) { failTo('The SMS number must match the selected recipient record.'); return; }
  const entityName = recipientType === 'owner' ? entity.full_name : entity.name;

  // Find or create conversation
  const { data: existingConv } = await db
    .from('sms_conversations')
    .select('id')
    .eq('portfolio_id', me.portfolio?.id)
    .eq('with_entity_type', recipientType)
    .eq('with_entity_id', recipientId)
    .maybeSingle();

  let conversationId: string;
  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const { data: newConv, error: convErr } = await db
      .from('sms_conversations')
      .insert({
        portfolio_id: me.portfolio?.id,
        with_entity_type: recipientType,
        with_entity_id: recipientId,
        with_name: entityName,
        with_phone_number: phoneNumber,
        our_phone_number: fromNumber,
        last_message_at: new Date().toISOString(),
        last_message_preview: body.substring(0, 100),
        unread_count: 0,
      })
      .select('id')
      .single();

    if (convErr) { failTo(convErr.message); return; }
    conversationId = newConv.id;
  }

  // Until a provider accepts the message, this is only queued. The gateway
  // integration must set provider_message_id and advance delivery status.
  const { error: msgErr } = await db.from('sms_messages').insert({
    conversation_id: conversationId,
    direction: 'outbound',
    body,
    from_number: fromNumber,
    to_number: phoneNumber,
    status: 'queued',
    sent_at: null,
    sent_by: me.auth_user_id,
  });

  if (msgErr) { failTo(msgErr.message); return; }

  // Also record in communication_messages for the central communication hub
  await db.from('communication_messages').insert({
    portfolio_id: me.portfolio?.id,
    channel: 'sms',
    status: 'queued',
    recipient_group: recipientType,
    recipient_phone: phoneNumber,
    body,
    sent_at: null,
    created_by: me.auth_user_id,
  });

  // Update conversation preview
  await db
    .from('sms_conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: body.substring(0, 100),
    })
    .eq('id', conversationId);

  revalidatePath('/sms');
  revalidatePath('/communication-center');
  revalidatePath('/inbox');

  const returnTo = safeInternalNext(str(formData, 'return_to'));
  if (returnTo) redirect(returnTo);
  redirect('/sms');
}

/** Create or update an SMS template. */
export async function saveTemplate(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const failTo = (msg: string) => {
    redirect(`/sms/templates?error=${encodeURIComponent(msg)}`);
  };

  const id = str(formData, 'id');
  const name = req(formData, 'name');
  const channel = str(formData, 'channel') ?? 'sms';
  const category = str(formData, 'category') ?? 'general';
  const subject = str(formData, 'subject');
  const body = req(formData, 'body');

  const payload: any = {
    portfolio_id: me.portfolio?.id,
    name,
    channel,
    category,
    subject,
    body,
    created_by: me.auth_user_id,
    updated_at: new Date().toISOString(),
  };

  if (id) {
    // Update existing
    const { error } = await db.from('message_templates').update(payload).eq('id', id);
    if (error) { failTo(error.message); return; }
  } else {
    // Create new
    const { error } = await db.from('message_templates').insert(payload);
    if (error) { failTo(error.message); return; }
  }

  revalidatePath('/sms/templates');
  redirect('/sms/templates');
}

/** Delete a template */
export async function deleteTemplate(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const id = req(formData, 'id');
  const { error } = await db.from('message_templates').delete().eq('id', id);
  if (error) redirect(`/sms/templates?error=${encodeURIComponent(error.message)}`);

  revalidatePath('/sms/templates');
  redirect('/sms/templates');
}

/** Toggle opt-in status for a phone number. */
export async function toggleOptIn(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

  const entityType = req(formData, 'entity_type');
  const entityId = req(formData, 'entity_id');
  const phoneNumber = canonicalPhone(req(formData, 'phone_number'));
  const optedIn = formData.get('opted_in') === 'true';
  const consentSource = str(formData, 'consent_source');
  const failTo = (msg: string) => {
    redirect(`/sms/opt-ins?error=${encodeURIComponent(msg)}`);
  };
  if (!['owner', 'vendor'].includes(entityType)) { failTo('SMS consent is limited to owners and vendors.'); return; }
  if (optedIn && (!consentSource || consentSource.length < 10)) { failTo('Record how consent was obtained (at least 10 characters).'); return; }

  const { data: entity } = entityType === 'owner'
    ? await db.from('owners').select('phone, phone_numbers').eq('id', entityId).maybeSingle()
    : await db.from('vendors').select('phone_numbers').eq('id', entityId).maybeSingle();
  const entityPhones = [entity?.phone, ...(Array.isArray(entity?.phone_numbers) ? entity.phone_numbers.map((entry: any) => entry?.number) : [])]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map(canonicalPhone);
  if (!entity || !entityPhones.includes(phoneNumber)) { failTo('The phone number must belong to the selected recipient.'); return; }

  const { data: existing } = await db
    .from('sms_opt_ins')
    .select('id')
    .eq('portfolio_id', me.portfolio?.id)
    .eq('phone_number', phoneNumber)
    .maybeSingle();

  const payload = {
    portfolio_id: me.portfolio?.id,
    entity_type: entityType,
    entity_id: entityId,
    phone_number: phoneNumber,
    opted_in: optedIn,
    opted_in_at: optedIn ? new Date().toISOString() : null,
    opted_out_at: optedIn ? null : new Date().toISOString(),
    source: optedIn ? consentSource : 'staff_recorded_opt_out',
    notes: optedIn ? `Consent evidence: ${consentSource}` : 'Opt-out recorded by staff.',
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await db.from('sms_opt_ins').update(payload).eq('id', existing.id);
    if (error) { failTo(error.message); return; }
  } else {
    const { error } = await db.from('sms_opt_ins').insert(payload);
    if (error) { failTo(error.message); return; }
  }

  revalidatePath('/sms/opt-ins');
  redirect('/sms/opt-ins');
}
