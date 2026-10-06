// Per-company sender domains (white label). A company's mail goes out from
// its own verified domain (notices@stellarpropertygroup.com) instead of the
// platform address. Rows live in portfolio_email_domains; the domain is
// registered and verified with Resend, the same account that sends the mail.
import { Resend } from 'resend';
import { EMAIL_FROM, EMAIL_FROM_NAME, EMAIL_FROM_NOREPLY } from '@/lib/email/queue';
import { parseCustomDomain } from '@/lib/tenant/custom-domain';

export const DEFAULT_FROM_LOCAL_PART = 'notices';
const LOCAL_PART = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;

export type SenderDomainRow = {
  portfolio_id: string;
  domain: string;
  from_local_part: string;
  provider_domain_id: string | null;
  status: string;
  records: unknown;
  enabled: boolean;
  verified_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
};

export type DnsRecordRow = { record: string; type: string; name: string; value: string; priority: number | null; status: string };

/** Validate the sending domain and the part before @. */
export function parseSenderSettings(domainValue: unknown, localValue: unknown):
  { ok: true; domain: string; localPart: string } | { ok: false; error: string } {
  const domain = parseCustomDomain(domainValue);
  if (!domain.ok) return domain;
  if (!domain.domain) return { ok: false, error: 'Enter the domain the company sends from, such as stellarpropertygroup.com.' };
  const localPart = String(localValue ?? '').trim().toLowerCase() || DEFAULT_FROM_LOCAL_PART;
  if (localPart.includes('..') || !LOCAL_PART.test(localPart)) {
    return { ok: false, error: 'Use letters, numbers, dots, hyphens or underscores before the @ (for example, notices).' };
  }
  return { ok: true, domain: domain.domain, localPart };
}

/** The company's own sending address, only while its domain is verified and switched on. */
export function brandedFromAddress(row: Pick<SenderDomainRow, 'domain' | 'from_local_part' | 'status' | 'enabled'> | null | undefined): string | null {
  if (!row || !row.enabled || row.status !== 'verified') return null;
  return `${row.from_local_part || DEFAULT_FROM_LOCAL_PART}@${row.domain}`;
}

/** Only mail queued from the platform's default sender is moved to a company's domain. */
export function usesPlatformSender(fromAddress: string | null | undefined): boolean {
  const from = String(fromAddress ?? '').trim().toLowerCase();
  return !from || from === EMAIL_FROM || from === EMAIL_FROM_NOREPLY;
}

/**
 * Platform-originated mail names the platform as its sender (Portier369,
 * Portier369 Platform) and stays on the platform domain. Anything else that
 * belongs to a company (no name, or the company's or association's name) is
 * company mail.
 */
export function isPlatformSenderName(name: string | null | undefined): boolean {
  return String(name ?? '').trim().toLowerCase().startsWith(EMAIL_FROM_NAME.toLowerCase());
}

/** Whether a provider error means the sending domain itself was refused. */
export function isSenderDomainError(message: string | null | undefined): boolean {
  return /domain|not verified|verify/i.test(String(message ?? ''));
}

/** DNS records as stored from Resend, in a stable shape for display. */
export function dnsRecords(records: unknown): DnsRecordRow[] {
  if (!Array.isArray(records)) return [];
  return records
    .filter((r) => r && typeof r === 'object')
    .map((r: any) => ({
      record: String(r.record ?? ''),
      type: String(r.type ?? ''),
      name: String(r.name ?? ''),
      value: String(r.value ?? ''),
      priority: typeof r.priority === 'number' ? r.priority : null,
      status: String(r.status ?? ''),
    }))
    .filter((r) => r.type && r.name && r.value);
}

const PROVIDER_STATUSES = new Set(['not_started', 'pending', 'verified', 'failed', 'partially_verified', 'partially_failed', 'temporary_failure']);

/** Map a provider status onto the stored status (unknown values read as pending). */
export function storedStatus(status: unknown): string {
  const s = String(status ?? '');
  return PROVIDER_STATUSES.has(s) ? s : 'pending';
}

export function resendClient(): Resend | null {
  return process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
}

type RegisteredDomain = { id: string; status: string; records: unknown };

/**
 * Register a sending domain with Resend. A domain already in the account (for
 * example, a company switching back to an earlier domain) is reused instead of
 * failing; the caller has already checked no other company holds it.
 */
export async function registerSenderDomain(resend: Resend, name: string):
  Promise<{ ok: true; domain: RegisteredDomain } | { ok: false; error: string }> {
  const { data: created, error: createError } = await resend.domains.create({ name });
  if (created) return { ok: true, domain: { id: created.id, status: created.status, records: created.records ?? [] } };

  let after: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const { data: list, error: listError } = await resend.domains.list({ limit: 100, ...(after ? { after } : {}) });
    if (listError || !list) break;
    const existing = list.data.find((d) => d.name.toLowerCase() === name);
    if (existing) {
      const { data: domain, error: getError } = await resend.domains.get(existing.id);
      if (domain) return { ok: true, domain: { id: domain.id, status: domain.status, records: domain.records ?? [] } };
      return { ok: false, error: getError?.message ?? 'The existing domain could not be read.' };
    }
    if (!list.has_more || !list.data.length) break;
    after = list.data[list.data.length - 1].id;
  }
  return { ok: false, error: createError?.message ?? 'No response from the email provider.' };
}
