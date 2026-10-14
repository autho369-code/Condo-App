import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { canonicalPhone, validTwilioSignature } from '@/lib/sms/twilio';
import { logUnmatchedReply, recordInboundReply, senderCompanies, textedConversations } from '@/lib/sms/inbound-reply';

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
  const from = canonicalPhone(form.get('From') ?? '');
  const to = canonicalPhone(form.get('To') ?? '');
  if (!/^\+[1-9]\d{7,14}$/.test(from)) return NextResponse.json({ error: 'Invalid sender number' }, { status: 400 });

  const db = createServiceClient() as any;

  // A reply (not STOP/START) goes into the sender's conversation for staff.
  if (!['STOP', 'START'].includes(optOutType)) {
    try {
      const result = await recordInboundReply(db, {
        from,
        to,
        body: String(form.get('Body') ?? ''),
        messageSid: String(form.get('MessageSid') ?? '') || null,
      });
      // Not filed with any one company; each is told a text arrived.
      if (result.status === 'ambiguous') await logUnmatchedReply(db, result.portfolioIds, from);
      return new NextResponse(null, { status: 204 });
    } catch (error: any) {
      // A 500 makes Twilio retry; the message id keeps the retry from doubling.
      return NextResponse.json({ error: error?.message ?? 'Could not record the reply' }, { status: 500 });
    }
  }
  if (optOutType === 'STOP') {
    // Every company's record for the number.
    const { error } = await db.from('sms_opt_ins').update({
      opted_in: false,
      opted_in_at: null,
      opted_out_at: new Date().toISOString(),
      source: 'twilio_advanced_opt_out',
      notes: 'STOP received and verified by Twilio inbound webhook.',
    })
      .eq('phone_number', from)
      .in('entity_type', ['owner', 'vendor']);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
  }

  // START: the one company that knows them, else the one that texted them
  // from the number they texted (as Twilio reported it).
  let company: string | null;
  try {
    const companies = await senderCompanies(db, from);
    if (companies.length === 0) return new NextResponse(null, { status: 204 });
    company = companies.length === 1 ? companies[0] : null;
    if (!company) {
      const texted = [...new Set((await textedConversations(db, from, to)).map((c) => c.portfolio_id))];
      company = texted.length === 1 ? texted[0] : null;
    }
  } catch (matchError: any) {
    return NextResponse.json({ error: matchError?.message ?? 'Could not match the sender' }, { status: 500 });
  }
  if (!company) return NextResponse.json({ error: 'Ambiguous SMS consent owner' }, { status: 409 });

  const { error } = await db.from('sms_opt_ins').update({
    opted_in: true,
    opted_in_at: new Date().toISOString(),
    opted_out_at: null,
    source: 'twilio_advanced_opt_out',
    notes: `${optOutType} received and verified by Twilio inbound webhook.`,
  })
    .eq('portfolio_id', company)
    .eq('phone_number', from)
    .in('entity_type', ['owner', 'vendor']);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
