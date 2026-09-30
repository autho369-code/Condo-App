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
  const { error } = await (createServiceClient() as any).rpc('record_email_event', {
    p_provider_message_id: messageId,
    p_event_type: type,
    p_occurred_at: event.created_at ?? null,
    p_provider_event_id: request.headers.get('svix-id'),
    p_detail: detail ? String(detail).slice(0, 500) : null,
  });
  if (error) return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
