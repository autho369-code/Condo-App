import { createHmac, timingSafeEqual } from 'node:crypto';

// Resend signs webhooks with Svix: HMAC-SHA256 over "<id>.<timestamp>.<body>"
// using the base64 secret after the "whsec_" prefix. The header carries one or
// more space-separated "v1,<base64 signature>" entries (secret rotation).
const TOLERANCE_SECONDS = 5 * 60;

export function verifySvixSignature(input: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  now?: number;
}): boolean {
  const { secret, id, timestamp, signature, body } = input;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice(6) : secret, 'base64');
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  return signature.split(' ').some((part) => {
    const [version, sig] = part.split(',', 2);
    if (version !== 'v1' || !sig) return false;
    const given = Buffer.from(sig, 'base64');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** Resend event type ("email.opened") → our email_events.event_type. */
export function resendEventType(type: unknown): string | null {
  const map: Record<string, string> = {
    'email.sent': 'sent',
    'email.delivered': 'delivered',
    'email.delivery_delayed': 'delivery_delayed',
    'email.opened': 'opened',
    'email.clicked': 'clicked',
    'email.bounced': 'bounced',
    'email.complained': 'complained',
    'email.failed': 'failed',
  };
  return typeof type === 'string' ? map[type] ?? null : null;
}
