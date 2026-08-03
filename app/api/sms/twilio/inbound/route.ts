import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { canonicalPhone, validTwilioSignature } from '@/lib/sms/twilio';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const base = process.env.TWILIO_WEBHOOK_BASE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!authToken || !base) return NextResponse.json({ error: 'Twilio inbound verification is not configured' }, { status: 503 });

  const form = new URLSearchParams(await request.text());
  const canonicalUrl = new URL('/api/sms/twilio/inbound', new URL(base).origin).toString();
  if (!validTwilioSignature(authToken, canonicalUrl, form, request.headers.get('x-twilio-signature'))) {
    return NextResponse.json({ error: 'Invalid Twilio signature' }, { status: 401 });
  }

  const optOutType = String(form.get('OptOutType') ?? '').toUpperCase();
  if (!['STOP', 'START'].includes(optOutType)) return new NextResponse(null, { status: 204 });
  const from = canonicalPhone(form.get('From') ?? '');
  const to = canonicalPhone(form.get('To') ?? '');
  if (!/^\+[1-9]\d{7,14}$/.test(from)) return NextResponse.json({ error: 'Invalid sender number' }, { status: 400 });

  const db = createServiceClient() as any;
  const { data: candidates, error: readError } = await db.from('sms_opt_ins')
    .select('id, portfolio_id')
    .eq('phone_number', from)
    .in('entity_type', ['owner', 'vendor'])
    .limit(10);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  let matching = candidates ?? [];

  if (optOutType === 'STOP' && matching.length > 0) {
    const now = new Date().toISOString();
    const { error } = await db.from('sms_opt_ins').update({
      opted_in: false,
      opted_in_at: null,
      opted_out_at: now,
      source: 'twilio_advanced_opt_out',
      notes: 'STOP received and verified by Twilio inbound webhook.',
    }).in('id', matching.map((candidate: any) => candidate.id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
  }

  if (matching.length > 1 && to) {
    const { data: conversations } = await db.from('sms_conversations')
      .select('portfolio_id')
      .eq('with_phone_number', from)
      .eq('our_phone_number', to)
      .limit(10);
    const portfolioIds = new Set((conversations ?? []).map((conversation: any) => conversation.portfolio_id));
    matching = matching.filter((candidate: any) => portfolioIds.has(candidate.portfolio_id));
  }
  if (matching.length === 0) return new NextResponse(null, { status: 204 });
  if (matching.length !== 1) return NextResponse.json({ error: 'Ambiguous SMS consent owner' }, { status: 409 });

  const now = new Date().toISOString();
  const { error } = await db.from('sms_opt_ins').update({
    opted_in: true,
    opted_in_at: now,
    opted_out_at: null,
    source: 'twilio_advanced_opt_out',
    notes: `${optOutType} received and verified by Twilio inbound webhook.`,
  }).eq('id', matching[0].id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
