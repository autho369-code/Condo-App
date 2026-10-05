import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { EMAIL_FROM, EMAIL_FROM_NAME } from '@/lib/email/queue';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanHeader(value: unknown, fallback: string, max = 200): string {
  return String(value ?? '').replace(/[\r\n\0]+/g, ' ').replace(/"/g, '').trim().slice(0, max) || fallback;
}

async function inBatches<T>(items: T[], size: number, run: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(run));
  }
}

export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email provider is not configured' }, { status: 503 });
  }

  const db = createServiceClient() as any;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: claimed, error: claimError } = await db.rpc('claim_email_queue', { p_limit: 20 });
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  // White label: an email that belongs to a client company goes out under
  // that company's name, not the platform's. Only the sending address stays
  // on the platform's verified domain. A failed lookup keeps the default name.
  const brandIds = [...new Set(((claimed ?? []) as any[])
    .filter((e) => e.portfolio_id && (!e.from_name || e.from_name === EMAIL_FROM_NAME))
    .map((e) => String(e.portfolio_id)))];
  const brandNames = new Map<string, string>();
  if (brandIds.length) {
    const { data: brands, error: brandError } = await db.from('portfolios').select('id, company_name').in('id', brandIds);
    if (brandError) console.error('Could not load sender branding:', brandError.message);
    for (const b of brands ?? []) if (b.company_name) brandNames.set(String(b.id), String(b.company_name));
  }
  const senderName = (email: any): string => {
    const branded = email.portfolio_id ? brandNames.get(String(email.portfolio_id)) : undefined;
    if (branded && (!email.from_name || email.from_name === EMAIL_FROM_NAME)) return branded;
    return email.from_name ?? EMAIL_FROM_NAME;
  };

  let sent = 0;
  let failed = 0;
  await inBatches(claimed ?? [], 4, async (email: any) => {
    try {
      const to = String(email.to_email ?? '').trim().toLowerCase();
      const fromAddress = String(email.from_address ?? EMAIL_FROM).trim().toLowerCase();
      if (!EMAIL_PATTERN.test(to) || !EMAIL_PATTERN.test(fromAddress)) throw new Error('Invalid queued email address');

      const { data, error } = await resend.emails.send({
        from: `${cleanHeader(senderName(email), EMAIL_FROM_NAME)} <${fromAddress}>`,
        to: email.to_name ? `${cleanHeader(email.to_name, '', 200)} <${to}>` : to,
        subject: cleanHeader(email.subject, `Message from ${senderName(email)}`, 300),
        html: String(email.body ?? ''),
        ...(email.reply_to && EMAIL_PATTERN.test(String(email.reply_to).trim())
          ? { replyTo: String(email.reply_to).trim().toLowerCase() }
          : {}),
      }, { idempotencyKey: `email-queue-${email.id}` });
      if (error) throw new Error(error.message);

      const { data: completed, error: completeError } = await db.rpc('complete_email_delivery', {
        p_email_id: email.id,
        p_provider_message_id: data?.id ?? '',
      });
      if (completeError || !completed) throw new Error(completeError?.message ?? 'Queue completion was not recorded');
      sent += 1;
    } catch (error: any) {
      failed += 1;
      const { error: failError } = await db.rpc('fail_email_delivery', {
        p_email_id: email.id,
        p_error: error?.message ?? 'Email delivery failed',
      });
      if (failError) console.error('Could not record email delivery failure:', failError.message);
    }
  });

  return NextResponse.json({ claimed: claimed?.length ?? 0, sent, failed });
}
