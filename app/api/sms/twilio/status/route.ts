import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { mapTwilioStatus, validTwilioSignature } from '@/lib/sms/twilio';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const base = process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!authToken || !base) return NextResponse.json({ error: 'Twilio callback verification is not configured' }, { status: 503 });
  const form = new URLSearchParams(await request.text());
  const canonicalUrl = new URL('/api/sms/twilio/status', new URL(base).origin).toString();
  if (!validTwilioSignature(authToken, canonicalUrl, form, request.headers.get('x-twilio-signature'))) {
    return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 401 });
  }
  const sid = form.get('MessageSid') ?? '';
  const status = mapTwilioStatus(form.get('MessageStatus') ?? '');
  if (!/^SM[a-f0-9]{32}$/i.test(sid) || !status) return NextResponse.json({ error: 'Invalid status callback' }, { status: 400 });
  const { error } = await (createServiceClient() as any).rpc('apply_twilio_sms_status', {
    p_provider_message_id: sid,
    p_status: status,
    p_error_code: form.get('ErrorCode'),
    p_error_message: form.get('ErrorMessage'),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
