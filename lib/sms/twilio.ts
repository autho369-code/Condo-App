import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

const E164 = /^\+[1-9]\d{7,14}$/;

export function canonicalPhone(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, '');
  if (/^\d{10}$/.test(compact)) return `+1${compact}`;
  if (/^1\d{10}$/.test(compact)) return `+${compact}`;
  return compact;
}

export function smsDeliveryConfigured() {
  const callback = process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  return process.env.SMS_DELIVERY_ENABLED === 'true'
    && Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_MESSAGING_SERVICE_SID && callback);
}

export function twilioSignature(authToken: string, url: string, params: URLSearchParams) {
  // Twilio specifies Unix-style case-sensitive ordering, not locale collation.
  const pairs = [...params.entries()].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const signed = pairs.reduce((value, [key, item]) => value + key + item, url);
  return createHmac('sha1', authToken).update(signed).digest('base64');
}

export function validTwilioSignature(authToken: string, url: string, params: URLSearchParams, provided: string | null) {
  if (!provided) return false;
  const expected = Buffer.from(twilioSignature(authToken, url, params));
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function mapTwilioStatus(status: string): 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered' | null {
  if (['accepted', 'scheduled', 'queued'].includes(status)) return 'queued';
  if (['sending', 'sent'].includes(status)) return 'sent';
  if (status === 'delivered') return 'delivered';
  if (status === 'undelivered') return 'undelivered';
  if (['failed', 'canceled'].includes(status)) return 'failed';
  return null;
}

function callbackBase() {
  const raw = process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) throw new Error('TWILIO_WEBHOOK_BASE_URL is not configured');
  const url = new URL(raw);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('Twilio callback base must be a public HTTPS URL');
  return url.origin;
}

export async function sendTwilioSms(message: { to: string; from: string; body: string }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const configuredFrom = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !/^AC[a-f0-9]{32}$/i.test(accountSid)) throw new Error('Twilio credentials are not configured');
  const to = canonicalPhone(message.to);
  if (!E164.test(to)) throw new Error('Recipient phone number must use E.164 format');
  const from = configuredFrom ?? message.from;
  if (!messagingServiceSid && !E164.test(from)) throw new Error('Twilio sender is not configured');
  if (message.body.length < 1 || message.body.length > 1600) throw new Error('SMS body must contain 1 to 1600 characters');

  const form = new URLSearchParams({
    To: to,
    Body: message.body,
    StatusCallback: `${callbackBase()}/api/sms/twilio/status`,
    ...(messagingServiceSid ? { MessagingServiceSid: messagingServiceSid } : { From: from }),
  });
  let response: Response;
  try {
    response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form,
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error: any) {
    throw Object.assign(new Error(error?.message ?? 'Twilio delivery outcome is unknown'), { deliveryOutcomeUnknown: true });
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.sid) throw Object.assign(new Error(result.message ?? `Twilio returned HTTP ${response.status}`), {
    code: result.code ? String(result.code) : 'twilio_error',
    deliveryOutcomeUnknown: response.status >= 500,
  });
  return { id: String(result.sid), status: String(result.status ?? 'queued') };
}
