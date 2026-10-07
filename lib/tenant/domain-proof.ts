// Proof that a custom domain serves a given company: the domain-check
// endpoint, reached on the company's domain, answers with this value for the
// company the request resolved to, and the verify job compares it. A match
// means DNS, HTTPS and routing all work for that company. Keyed with a
// server-only secret and bound to a fresh random challenge from the job, so a
// host that is not this app (a lapsed or taken-over domain) can neither
// compute it nor replay an answer it recorded earlier.
import { createHmac, randomBytes } from 'node:crypto';
import { normalizeHostname } from '@/lib/tenant/host';

export const DOMAIN_CHECK_PATH = '/api/tenant/domain-check';

/** The server-only key (CRON_SECRET, already required for the job); null if unset. */
function proofKey(): string | null {
  const secret = process.env.CRON_SECRET;
  return secret && Buffer.byteLength(secret, 'utf8') >= 32 ? secret : null;
}

const CHALLENGE = /^[0-9a-f]{32,128}$/;

export function isDomainChallenge(value: unknown): value is string {
  return typeof value === 'string' && CHALLENGE.test(value);
}

export function newDomainChallenge(): string {
  return randomBytes(32).toString('hex');
}

/** Null when no key is configured or the challenge is malformed: then nothing can be verified. */
export function domainProof(portfolioId: string, hostname: string, challenge: string): string | null {
  const key = proofKey();
  if (!key || !isDomainChallenge(challenge)) return null;
  return createHmac('sha256', key)
    .update(`portier369-domain-check:${portfolioId}:${normalizeHostname(hostname)}:${challenge}`)
    .digest('hex');
}

/**
 * Fetch the domain-check endpoint on `domain` and say whether it answers for
 * `portfolioId`. Redirects count as failure (a forwarded or parked domain is
 * not serving the company).
 */
export async function domainServesCompany(
  domain: string,
  portfolioId: string,
  { timeoutMs = 8000, fetchImpl = fetch, challenge = newDomainChallenge() }: { timeoutMs?: number; fetchImpl?: typeof fetch; challenge?: string } = {},
): Promise<boolean> {
  const host = normalizeHostname(domain);
  const expected = host ? domainProof(portfolioId, host, challenge) : null;
  if (!host || !expected) return false;
  try {
    const res = await fetchImpl(`https://${host}${DOMAIN_CHECK_PATH}?challenge=${challenge}`, {
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status !== 200) return false;
    const body = await res.json().catch(() => null);
    return body?.proof === expected;
  } catch {
    return false;
  }
}
