import 'server-only';

type MailPiece = {
  id: string;
  idempotency_key: string;
  description: string;
  recipient_name: string;
  address_line1: string;
  address_line2?: string | null;
  address_city: string;
  address_state: string;
  address_zip: string;
  address_country: string;
  content_html: string;
  mail_class: 'first_class' | 'standard';
  color: boolean;
  double_sided: boolean;
};

function fromAddress() {
  const fields = {
    name: process.env.PHYSICAL_MAIL_FROM_NAME,
    address_line1: process.env.PHYSICAL_MAIL_FROM_ADDRESS_LINE1,
    address_line2: process.env.PHYSICAL_MAIL_FROM_ADDRESS_LINE2 || undefined,
    address_city: process.env.PHYSICAL_MAIL_FROM_CITY,
    address_state: process.env.PHYSICAL_MAIL_FROM_STATE,
    address_zip: process.env.PHYSICAL_MAIL_FROM_ZIP,
    address_country: 'US',
  };
  if (!fields.name || !fields.address_line1 || !fields.address_city || !fields.address_state || !fields.address_zip) throw new Error('Physical-mail return address is not configured');
  return { ...fields, name: fields.name.slice(0, 40) };
}

export async function submitLobLetter(piece: MailPiece) {
  const apiKey = process.env.LOB_API_KEY;
  if (!apiKey) throw new Error('Lob API key is not configured');
  const response = await fetch('https://api.lob.com/v1/letters', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`,
      'content-type': 'application/json',
      'idempotency-key': piece.idempotency_key,
      'lob-version': '2024-01-01',
    },
    body: JSON.stringify({
      description: piece.description,
      to: {
        name: piece.recipient_name.slice(0, 40),
        address_line1: piece.address_line1,
        address_line2: piece.address_line2 || undefined,
        address_city: piece.address_city,
        address_state: piece.address_state,
        address_zip: piece.address_zip,
        address_country: piece.address_country,
      },
      from: fromAddress(),
      file: piece.content_html,
      color: piece.color,
      double_sided: piece.double_sided,
      mail_type: piece.mail_class === 'standard' ? 'usps_standard' : 'usps_first_class',
      metadata: { portier_mail_id: piece.id },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) throw new Error(result?.error?.message ?? result?.message ?? `Lob returned HTTP ${response.status}`);
  return {
    id: String(result.id),
    url: String(result.url ?? ''),
    expectedDeliveryDate: result.expected_delivery_date ? String(result.expected_delivery_date) : null,
  };
}

export async function fetchLobLetterStatus(providerPieceId: string) {
  const apiKey = process.env.LOB_API_KEY;
  if (!apiKey || !/^ltr_[a-z0-9]+$/i.test(providerPieceId)) throw new Error('Lob tracking is not configured');
  const response = await fetch(`https://api.lob.com/v1/letters/${providerPieceId}`, {
    headers: { authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`, 'lob-version': '2024-01-01' },
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message ?? `Lob returned HTTP ${response.status}`);
  const events = Array.isArray(result.tracking_events) ? result.tracking_events : [];
  const names = new Set<string>(events.map((event: any) => String(event.name ?? '').toLowerCase()));
  const status = names.has('delivered') ? 'delivered'
    : names.has('returned to sender') ? 'returned'
    : [...names].some((name) => ['mailed', 'in transit', 'in local area', 'processed for delivery', 're-routed'].includes(name)) ? 'in_transit'
    : 'submitted';
  return { status, expectedDeliveryDate: result.expected_delivery_date ? String(result.expected_delivery_date) : null };
}
