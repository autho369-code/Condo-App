export type TextRecipientGroup = 'owners' | 'renters' | 'both' | 'custom';

export type TextRecipient = {
  name: string;
  phone: string;
  group: 'owner' | 'renter' | 'custom';
  entityType: 'owner' | 'renter' | 'custom';
  entityId: string | null;
};

export type NormalizedTextMessageForm = {
  recipientGroup: TextRecipientGroup;
  body: string;
  customPhone: string | null;
  returnTo: string | null;
};

const RECIPIENT_GROUPS = new Set<TextRecipientGroup>(['owners', 'renters', 'both', 'custom']);

export function normalizeTextPhone(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (hasPlus) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export function normalizeTextMessageForm(formData: FormData): NormalizedTextMessageForm {
  const rawGroup = String(formData.get('recipient_group') ?? 'owners');
  const recipientGroup = RECIPIENT_GROUPS.has(rawGroup as TextRecipientGroup)
    ? rawGroup as TextRecipientGroup
    : 'owners';
  const body = String(formData.get('message') ?? '').trim();
  if (!body) throw new Error('Text message is required.');
  const customPhone = normalizeTextPhone(String(formData.get('custom_phone') ?? ''));
  const returnTo = String(formData.get('return_to') ?? '').trim();

  return {
    recipientGroup,
    body,
    customPhone,
    returnTo: returnTo.startsWith('/') ? returnTo : null,
  };
}

export function uniqueTextRecipients(recipients: TextRecipient[]) {
  const seen = new Set<string>();
  const unique: TextRecipient[] = [];
  for (const recipient of recipients) {
    const phone = normalizeTextPhone(recipient.phone);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    unique.push({ ...recipient, phone });
  }
  return unique;
}

export function buildTextMessageRows({
  associationId,
  body,
  createdBy,
  portfolioId,
  recipients,
}: {
  associationId: string | null;
  body: string;
  createdBy: string | null;
  portfolioId: string | null;
  recipients: TextRecipient[];
}) {
  const queuedAt = new Date().toISOString();
  return recipients.map((recipient) => ({
    association_id: associationId,
    body,
    channel: 'sms' as const,
    created_by: createdBy,
    portfolio_id: portfolioId,
    queued_at: queuedAt,
    recipient_group: recipient.group,
    recipient_name: recipient.name,
    recipient_phone: recipient.phone,
    status: 'draft' as const,
    subject: 'Text message',
  }));
}
