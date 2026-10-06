import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/server';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { EMAIL_FROM_NAME } from '@/lib/email/queue';
import { addressDomain, brandedFromAddress, isPlatformSenderName, isSenderDomainError, platformSenderAddress, usesPlatformSender } from '@/lib/email/sender-domains';

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
  const { data: claimed, error: claimError } = await db.rpc('claim_email_queue_snapshot', { p_limit: 20 });
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });

  // White label: an email with no chosen sender name that belongs to a client
  // company goes out under that company's name. Company mail (no name, or a
  // company/association name) goes out from the company's own domain once
  // that domain is verified (portfolio_email_domains). Platform-originated
  // mail to a company (billing, onboarding) says Portier369 on purpose and
  // stays on the platform domain. A failed lookup falls back to the platform
  // name and address.
  const claimedRows = (claimed ?? []) as any[];
  // The company an email belongs to comes from its association when it has
  // one (signed-in staff write queue rows, and portfolio_id alone is not
  // proof); portfolio_id is used only for mail with no association.
  const associationIds = [...new Set(claimedRows.filter((e) => e.association_id).map((e) => String(e.association_id)))];
  const associationCompany = new Map<string, string | null>();
  let associationsUnavailable = false;
  if (associationIds.length) {
    const { data: assocs, error: assocError } = await db.from('associations').select('id, portfolio_id').in('id', associationIds);
    if (assocError) {
      console.error('Could not load email associations:', assocError.message);
      associationsUnavailable = true;
    }
    for (const a of assocs ?? []) associationCompany.set(String(a.id), a.portfolio_id ? String(a.portfolio_id) : null);
  }
  // Rows the earlier worker attempted keep its exact payload (same sender name
  // and the platform address) so a retry replays rather than resends.
  const earlierAttempt = (e: any) => Number(e.attempt_count ?? 1) > Number(e.snapshot_claims ?? 1);
  for (const e of claimedRows) {
    if (e.association_id && !earlierAttempt(e)) e.portfolio_id = associationCompany.get(String(e.association_id)) ?? null;
  }
  const brandIds = [...new Set(claimedRows
    .filter((e) => e.portfolio_id && !String(e.from_name ?? '').trim())
    .map((e) => String(e.portfolio_id)))];
  const companyIds = [...new Set(claimedRows
    .filter((e) => e.portfolio_id && !e.sender_address && !isPlatformSenderName(e.from_name) && usesPlatformSender(e.from_address))
    .map((e) => String(e.portfolio_id)))];
  let brandsUnavailable = false;
  const brandNames = new Map<string, string>();
  if (brandIds.length) {
    const { data: brands, error: brandError } = await db.from('portfolios').select('id, company_name').in('id', brandIds);
    if (brandError) {
      console.error('Could not load sender branding:', brandError.message);
      brandsUnavailable = true;
    }
    for (const b of brands ?? []) if (b.company_name) brandNames.set(String(b.id), String(b.company_name));
  }
  // A failed lookup must not silently change an email's sender: the affected
  // emails fail this run (nothing is sent) and are retried.
  let domainsUnavailable = false;
  let ownersUnavailable = false;
  const companySenders = new Map<string, string>();
  if (companyIds.length) {
    const { data: domains, error: domainError } = await db.from('portfolio_email_domains')
      .select('portfolio_id, domain, from_local_part, status, enabled').in('portfolio_id', companyIds);
    if (domainError) {
      console.error('Could not load sender domains:', domainError.message);
      domainsUnavailable = true;
    }
    for (const d of domains ?? []) {
      const address = brandedFromAddress(d);
      if (address) companySenders.set(String(d.portfolio_id), address);
    }
  }
  // A stored sender is honoured only when it is the platform address or on a
  // domain registered for the email's own company: queue rows can be written
  // by signed-in staff, who must never send as another company.
  const ownerIds = [...new Set(claimedRows
    .filter((e) => e.portfolio_id && e.sender_address)
    .map((e) => String(e.portfolio_id)))];
  const ownedDomains = new Set<string>();
  if (ownerIds.length) {
    const { data: owners, error: ownersError } = await db.from('email_sender_domain_owners')
      .select('portfolio_id, domain').in('portfolio_id', ownerIds);
    if (ownersError) {
      console.error('Could not load sender domain owners:', ownersError.message);
      ownersUnavailable = true;
    }
    for (const o of owners ?? []) ownedDomains.add(`${o.portfolio_id}:${String(o.domain).toLowerCase()}`);
  }
  const trustedStored = (email: any, platformAddress: string): string | null => {
    const stored = String(email.sender_address ?? '').trim().toLowerCase();
    if (!stored) return null;
    if (stored === platformAddress) return stored;
    return email.portfolio_id && ownedDomains.has(`${email.portfolio_id}:${addressDomain(stored)}`) ? stored : null;
  };

  // The first attempt picks the sending address; retries reuse the stored
  // choice so a replay after an accepted send is the identical request. A row
  // with no stored choice that the earlier worker attempted (more attempts
  // than this worker's claims) was sent from the platform address, so it
  // keeps it; one only this worker claimed chooses afresh.
  const primaryAddress = (email: any, platformAddress: string): string => {
    const stored = trustedStored(email, platformAddress);
    if (stored) return stored;
    if (earlierAttempt(email)) return platformAddress;
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
      const platformAddress = platformSenderAddress(email.from_address);
      if (!EMAIL_PATTERN.test(to) || !EMAIL_PATTERN.test(platformAddress)) throw new Error('Invalid queued email address');
      // No company name to send under: retry rather than mix the platform name
      // with the company's address (or send a replay under a different name).
      if (brandsUnavailable && email.portfolio_id && !String(email.from_name ?? '').trim()) {
        throw new Error('The company name could not be loaded; will retry.');
      }
      if (associationsUnavailable && email.association_id && !earlierAttempt(email)) {
        throw new Error('The email\'s company could not be loaded; will retry.');
      }
      const storedSender = String(email.sender_address ?? '').trim().toLowerCase();
      if (ownersUnavailable && storedSender && storedSender !== platformAddress) {
        throw new Error('Sender domains could not be checked; will retry.');
      }
      if (domainsUnavailable && !storedSender && email.portfolio_id && companyIds.includes(String(email.portfolio_id))) {
        throw new Error('Sender domains could not be loaded; will retry.');
      }
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
