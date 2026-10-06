import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { EMAIL_FROM, EMAIL_FROM_NAME } from '@/lib/email/queue';
import { brandedFromAddress, isPlatformSenderName, isSenderDomainError, usesPlatformSender } from '@/lib/email/sender-domains';

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

  // White label: an email with no chosen sender name that belongs to a client
  // company goes out under that company's name. Company mail (no name, or a
  // company/association name) goes out from the company's own domain once
  // that domain is verified (portfolio_email_domains). Platform-originated
  // mail to a company (billing, onboarding) says Portier369 on purpose and
  // stays on the platform domain. A failed lookup falls back to the platform
  // name and address.
  const claimedRows = (claimed ?? []) as any[];
  const brandIds = [...new Set(claimedRows
    .filter((e) => e.portfolio_id && !String(e.from_name ?? '').trim())
    .map((e) => String(e.portfolio_id)))];
  const companyIds = [...new Set(claimedRows
    .filter((e) => e.portfolio_id && !e.sender_address && !isPlatformSenderName(e.from_name) && usesPlatformSender(e.from_address))
    .map((e) => String(e.portfolio_id)))];
  const brandNames = new Map<string, string>();
  if (brandIds.length) {
    const { data: brands, error: brandError } = await db.from('portfolios').select('id, company_name').in('id', brandIds);
    if (brandError) console.error('Could not load sender branding:', brandError.message);
    for (const b of brands ?? []) if (b.company_name) brandNames.set(String(b.id), String(b.company_name));
  }
  const companySenders = new Map<string, string>();
  if (companyIds.length) {
    const { data: domains, error: domainError } = await db.from('portfolio_email_domains')
      .select('portfolio_id, domain, from_local_part, status, enabled').in('portfolio_id', companyIds);
    if (domainError) console.error('Could not load sender domains:', domainError.message);
    for (const d of domains ?? []) {
      const address = brandedFromAddress(d);
      if (address) companySenders.set(String(d.portfolio_id), address);
    }
  }
  // The first attempt picks the sending address; retries reuse the stored
  // choice so a replay after an accepted send is the identical request. A row
  // already attempted with no stored choice was handled by the worker before
  // sender domains existed, which always used the platform address.
  const primaryAddress = (email: any, platformAddress: string): string => {
    const stored = String(email.sender_address ?? '').trim().toLowerCase();
    if (stored) return stored;
    if (Number(email.attempt_count ?? 1) > 1) return platformAddress;
    if (!email.portfolio_id || isPlatformSenderName(email.from_name) || !usesPlatformSender(email.from_address)) return platformAddress;
    return companySenders.get(String(email.portfolio_id)) ?? platformAddress;
  };
  const senderName = (email: any): string => {
    const branded = email.portfolio_id ? brandNames.get(String(email.portfolio_id)) : undefined;
    if (String(email.from_name ?? '').trim()) return String(email.from_name);
    return branded ?? EMAIL_FROM_NAME;
  };

  let sent = 0;
  let failed = 0;
  await inBatches(claimed ?? [], 4, async (email: any) => {
    try {
      const to = String(email.to_email ?? '').trim().toLowerCase();
      const platformAddress = String(email.from_address || EMAIL_FROM).trim().toLowerCase();
      if (!EMAIL_PATTERN.test(to) || !EMAIL_PATTERN.test(platformAddress)) throw new Error('Invalid queued email address');
      const primary = primaryAddress(email, platformAddress);
      if (!EMAIL_PATTERN.test(primary)) throw new Error('Invalid sending address');
      const recordSender = async (address: string) => {
        const { error: snapshotError } = await db.from('email_queue').update({ sender_address: address }).eq('id', email.id);
        if (snapshotError) throw new Error(`Could not record the sending address: ${snapshotError.message}`);
      };
      if (String(email.sender_address ?? '').trim().toLowerCase() !== primary) await recordSender(primary);
      // One provider idempotency key per (email, sending address). The platform
      // address keeps the original email-queue-<id> key, so rows sent before
      // sender domains existed replay as the same request.
      const keyFor = (address: string) => address === platformAddress
        ? `email-queue-${email.id}`
        : `email-queue-${email.id}-${createHash('sha256').update(address).digest('hex').slice(0, 16)}`;

      const send = (fromAddress: string, idempotencyKey: string) => resend.emails.send({
        from: `${cleanHeader(senderName(email), EMAIL_FROM_NAME)} <${fromAddress}>`,
        to: email.to_name ? `${cleanHeader(email.to_name, '', 200)} <${to}>` : to,
        subject: cleanHeader(email.subject, `Message from ${senderName(email)}`, 300),
        html: String(email.body ?? ''),
        ...(email.reply_to && EMAIL_PATTERN.test(String(email.reply_to).trim())
          ? { replyTo: String(email.reply_to).trim().toLowerCase() }
          : {}),
      }, { idempotencyKey });

      let { data, error } = await send(primary, keyFor(primary));
      // A company domain that stopped verifying must not stop its mail: send
      // it from the platform address instead (a refused send was not sent).
      // The fallback becomes the stored choice before it is sent, so a retry
      // replays it rather than trying the company domain again.
      if (error && primary !== platformAddress && isSenderDomainError(error.message)) {
        console.error(`Sender domain refused for portfolio ${email.portfolio_id}:`, error.message);
        await recordSender(platformAddress);
        ({ data, error } = await send(platformAddress, keyFor(platformAddress)));
      }
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
