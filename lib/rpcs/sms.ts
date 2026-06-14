'use server';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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

  const recipientType = req(formData, 'recipient_type'); // owner | vendor | tenant
  const recipientId = req(formData, 'recipient_id');
  const phoneNumber = req(formData, 'phone_number');
  const body = req(formData, 'message');
  const fromNumber = str(formData, 'from_number') ?? me.portfolio?.phone_number ?? '+10000000000';

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
    // Resolve entity name
    let entityName = '';
    if (recipientType === 'owner') {
      const { data: owner } = await db.from('owners').select('full_name').eq('id', recipientId).maybeSingle();
      entityName = owner?.full_name ?? '';
    } else if (recipientType === 'vendor') {
      const { data: vendor } = await db.from('vendors').select('name').eq('id', recipientId).maybeSingle();
      entityName = vendor?.name ?? '';
    } else if (recipientType === 'tenant') {
      const { data: tenant } = await db.from('tenants').select('first_name, last_name').eq('id', recipientId).maybeSingle();
      entityName = tenant ? `${tenant.first_name ?? ''} ${tenant.last_name ?? ''}`.trim() : '';
    }

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

    if (convErr) return { error: convErr.message };
    conversationId = newConv.id;
  }

  // Insert SMS message
  const { error: msgErr } = await db.from('sms_messages').insert({
    conversation_id: conversationId,
    direction: 'outbound',
    body,
    from_number: fromNumber,
    to_number: phoneNumber,
    status: 'sent',
    sent_at: new Date().toISOString(),
    sent_by: me.auth_user_id,
  });

  if (msgErr) return { error: msgErr.message };

  // Also record in communication_messages for the central communication hub
  await db.from('communication_messages').insert({
    portfolio_id: me.portfolio?.id,
    channel: 'sms',
    status: 'sent',
    recipient_group: recipientType,
    recipient_phone: phoneNumber,
    body,
    sent_at: new Date().toISOString(),
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

  const returnTo = str(formData, 'return_to');
  if (returnTo && returnTo.startsWith('/')) redirect(returnTo);
  redirect('/sms');
}

/** Create or update an SMS template. */
export async function saveTemplate(formData: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const db = supabase as any;

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
    if (error) return { error: error.message };
  } else {
    // Create new
    const { error } = await db.from('message_templates').insert(payload);
    if (error) return { error: error.message };
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
  if (error) return { error: error.message };

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
  const phoneNumber = req(formData, 'phone_number');
  const optedIn = formData.get('opted_in') === 'true';

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
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await db.from('sms_opt_ins').update(payload).eq('id', existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await db.from('sms_opt_ins').insert(payload);
    if (error) return { error: error.message };
  }

  revalidatePath('/sms/opt-ins');
  redirect('/sms/opt-ins');
}
