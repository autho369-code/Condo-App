'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import {
  buildTextMessageRows,
  normalizeTextMessageForm,
  normalizeTextPhone,
  uniqueTextRecipients,
  type TextRecipient,
} from '@/lib/communications/text-messages';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export async function sendOwnerText(ownerId: string, formData: FormData) {
  const me = await requireStaff();
  const db = await createClient();
  const returnTo = `/owners/${ownerId}`;

  let normalized: ReturnType<typeof normalizeTextMessageForm>;
  try {
    normalized = normalizeTextMessageForm(formData);
  } catch (error) {
    redirectWithStatus(returnTo, 'text_error', error instanceof Error ? error.message : 'Could not send text.');
  }

  const portfolioId = me.portfolio?.id ?? null;
  if (!portfolioId) {
    redirectWithStatus(returnTo, 'text_error', 'Could not identify the current portfolio.');
  }

  const [{ data: owner, error: ownerError }, { data: portfolio }] = await Promise.all([
    (db as any)
      .from('owners')
      .select('id, full_name, phone, phone_numbers')
      .eq('id', ownerId)
      .is('archived_at', null)
      .maybeSingle(),
    (db as any)
      .from('portfolios')
      .select('texting_phone_number, phone_number')
      .eq('id', portfolioId)
      .maybeSingle(),
  ]);

  if (ownerError || !owner) {
    redirectWithStatus(returnTo, 'text_error', 'Owner was not found.');
  }

  const fromNumber = normalizeTextPhone(portfolio?.texting_phone_number ?? portfolio?.phone_number);
  if (!fromNumber) {
    redirectWithStatus(returnTo, 'text_error', 'Add a portfolio texting number in Settings before sending texts.');
  }

  const { data: occupancies } = await (db as any)
    .from('occupancies')
    .select('id, association_id, unit_id')
    .eq('owner_id', ownerId)
    .eq('status', 'current');

  const associationId = (occupancies ?? [])[0]?.association_id ?? null;
  const unitIds = [...new Set((occupancies ?? []).map((occupancy: any) => occupancy.unit_id).filter(Boolean))];

  let renters: any[] = [];
  if (unitIds.length > 0 && (normalized.recipientGroup === 'renters' || normalized.recipientGroup === 'both')) {
    const { data } = await (db as any)
      .from('tenancies')
      .select('id, tenant_name, tenant_phone')
      .in('unit_id', unitIds)
      .is('archived_at', null)
      .not('tenant_phone', 'is', null);
    renters = data ?? [];
  }

  const recipients: TextRecipient[] = [];
  if (normalized.recipientGroup === 'owners' || normalized.recipientGroup === 'both') {
    recipients.push(...ownerPhoneRecipients(owner));
  }
  if (normalized.recipientGroup === 'renters' || normalized.recipientGroup === 'both') {
    recipients.push(...renters.map((renter) => ({
      entityId: renter.id,
      entityType: 'renter' as const,
      group: 'renter' as const,
      name: renter.tenant_name ?? 'Renter',
      phone: renter.tenant_phone,
    })));
  }
  if (normalized.recipientGroup === 'custom' && normalized.customPhone) {
    recipients.push({
      entityId: null,
      entityType: 'custom',
      group: 'custom',
      name: 'Custom recipient',
      phone: normalized.customPhone,
    });
  }

  const uniqueRecipients = uniqueTextRecipients(recipients);
  if (uniqueRecipients.length === 0) {
    redirectWithStatus(returnTo, 'text_error', 'No textable phone numbers were found for the selected recipients.');
  }

  const communicationRows = buildTextMessageRows({
    associationId,
    body: normalized.body,
    createdBy: me.auth_user_id ?? null,
    portfolioId,
    recipients: uniqueRecipients,
  });
  const { error: communicationError } = await (db as any).from('communication_messages').insert(communicationRows);
  if (communicationError) {
    redirectWithStatus(returnTo, 'text_error', communicationError.message);
  }

  const now = new Date().toISOString();
  for (const recipient of uniqueRecipients) {
    const conversationId = await findOrCreateConversation(db, {
      associationId,
      fromNumber: fromNumber!,
      now,
      portfolioId: portfolioId!,
      recipient,
      preview: normalized.body,
    });

    const { error: messageError } = await (db as any).from('sms_messages').insert({
      body: normalized.body,
      conversation_id: conversationId,
      direction: 'outbound',
      from_number: fromNumber,
      media_urls: [],
      sent_at: now,
      sent_by: me.auth_user_id,
      status: 'queued',
      to_number: recipient.phone,
    });
    if (messageError) {
      redirectWithStatus(returnTo, 'text_error', messageError.message);
    }

    await (db as any)
      .from('sms_conversations')
      .update({
        last_message_at: now,
        last_message_preview: normalized.body.slice(0, 160),
        updated_at: now,
      })
      .eq('id', conversationId);
  }

  revalidatePath(returnTo);
  revalidatePath('/communication-center');
  revalidatePath('/inbox');
  redirectWithStatus(returnTo, 'text_sent', String(uniqueRecipients.length));
}

function ownerPhoneRecipients(owner: any): TextRecipient[] {
  const recipients: TextRecipient[] = [];
  if (owner.phone) {
    recipients.push({
      entityId: owner.id,
      entityType: 'owner',
      group: 'owner',
      name: owner.full_name ?? 'Owner',
      phone: owner.phone,
    });
  }
  const phoneNumbers = Array.isArray(owner.phone_numbers) ? owner.phone_numbers : [];
  for (const item of phoneNumbers) {
    const phone = typeof item === 'string' ? item : item?.number ?? item?.value;
    if (!phone) continue;
    recipients.push({
      entityId: owner.id,
      entityType: 'owner',
      group: 'owner',
      name: owner.full_name ?? 'Owner',
      phone,
    });
  }
  return recipients;
}

async function findOrCreateConversation(db: any, {
  associationId,
  fromNumber,
  now,
  portfolioId,
  preview,
  recipient,
}: {
  associationId: string | null;
  fromNumber: string;
  now: string;
  portfolioId: string;
  preview: string;
  recipient: TextRecipient;
}) {
  const { data: existing } = await db
    .from('sms_conversations')
    .select('id')
    .eq('portfolio_id', portfolioId)
    .eq('with_phone_number', recipient.phone)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data, error } = await db
    .from('sms_conversations')
    .insert({
      association_id: associationId,
      last_message_at: now,
      last_message_preview: preview.slice(0, 160),
      our_phone_number: fromNumber,
      portfolio_id: portfolioId,
      unread_count: 0,
      with_entity_id: recipient.entityId,
      with_entity_type: recipient.entityType,
      with_name: recipient.name,
      with_phone_number: recipient.phone,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? 'Could not create SMS conversation.');
  }
  return data.id;
}

function redirectWithStatus(returnTo: string, key: 'text_sent' | 'text_error', value: string): never {
  redirect(`${returnTo}?${key}=${encodeURIComponent(value)}`);
}
