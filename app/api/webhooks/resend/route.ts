import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resendEventType, verifySvixSignature } from '@/lib/email/webhook-signature';

export const dynamic = 'force-dynamic';

// Resend delivery events (delivered / opened / clicked / bounced / complained)
// → email_events + the email_queue row, shown on the homeowner's email history.
// Configure in Resend → Webhooks with this URL; put the signing secret in
// RESEND_WEBHOOK_SECRET. Open tracking must be enabled on the sending domain.
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Email webhook is not configured' }, { status: 503 });

  const body = await request.text();
  const valid = verifySvixSignature({
    secret,
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signature: request.headers.get('svix-signature'),
    body,
  });
  if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const type = resendEventType(event?.type);
  const messageId = typeof event?.data?.email_id === 'string' ? event.data.email_id : '';
  // Unknown event types are acknowledged so Resend does not retry them forever.
  if (!type || !messageId) return new NextResponse(null, { status: 204 });

  const detail =
    type === 'bounced' ? event.data?.bounce?.message ?? event.data?.bounce?.type
    : type === 'clicked' ? event.data?.click?.link
    : null;
  const { data: matched, error } = await (createServiceClient() as any).rpc('record_email_event', {
    p_provider_message_id: messageId,
    p_event_type: type,
    p_occurred_at: event.created_at ?? null,
    p_provider_event_id: request.headers.get('svix-id'),
    p_detail: detail ? String(detail).slice(0, 500) : null,
  });
  if (error) return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
  // A permanent bounce (the address doesn't exist) or a spam complaint stops
  // further mail to the address from this company. A temporary bounce
  // doesn't (the mailbox may be full for a day).
  const suppression = type === 'complained' ? 'complained'
    : type === 'bounced' && /^(permanent|hard)$/i.test(String(event.data?.bounce?.type ?? '')) ? 'bounced'
    : null;
  if (suppression && matched !== false) {
    const { error: suppressError } = await (createServiceClient() as any).rpc('email_suppress_from_event', {
      p_provider_message_id: messageId,
      p_reason: suppression,
      p_detail: detail ? String(detail).slice(0, 500) : null,
    });
    // Resend retries; the event itself is recorded once (by its id).
    if (suppressError) return NextResponse.json({ error: 'Could not record the bounce' }, { status: 500 });
  }
  // An event can beat the send worker, which stores the provider id only after
  // Resend accepts the email. Ask Resend to retry recent unmatched events; older
  // ones are for mail this app did not queue (e.g. auth emails) and are dropped.
  if (matched === false) {
    const at = Date.parse(event.created_at ?? '');
    if (Number.isFinite(at) && Date.now() - at < 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Email not recorded yet; retry' }, { status: 409 });
    }
  }
  return new NextResponse(null, { status: 204 });
}
