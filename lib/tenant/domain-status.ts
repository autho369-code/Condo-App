// Live status of a company's custom domain: whether it is on the Vercel
// project, verified, and whether public DNS points at Vercel yet, plus the DNS
// records still needed. Server-only (reads the Vercel token). Shown to the
// platform operator (who sets the domain up) and, read-only, to the company.
import type { Tone } from '@/components/operations/status-chip';
import {
  lookupDomain,
  pointsAtVercel,
  requiredDnsRecord,
  vercelDomainStatus,
  vercelDomainsEnv,
  type DnsRecord,
  type VercelDomainStatus,
} from '@/lib/tenant/custom-domain';

export type CustomDomainStatus = {
  tone: Tone;
  label: string;
  /** What public DNS answers now, such as "CNAME cname.vercel-dns.com". */
  current: string[];
  /** Records the domain still needs at its DNS provider (empty once live). */
  pendingRecords: DnsRecord[];
  vercel: VercelDomainStatus | null;
  vercelConfigured: boolean;
};

export async function customDomainStatus(domain: string): Promise<CustomDomainStatus> {
  const env = vercelDomainsEnv();
  const [vercel, answer] = await Promise.all([
    env ? vercelDomainStatus(env, domain) : Promise.resolve(null),
    lookupDomain(domain),
  ]);
  const attached = vercel?.state === 'attached' ? vercel : null;
  const record = requiredDnsRecord(domain, attached?.recommended);
  const dnsReady = attached?.misconfigured != null ? !attached.misconfigured : pointsAtVercel(answer, record);
  const current = [...answer.cnames.map((c) => `CNAME ${c}`), ...answer.ipv4.map((ip) => `A ${ip}`)];

  let tone: Tone = 'warning';
  let label = 'DNS not pointed yet';
  if (vercel?.state === 'not-attached') { tone = 'danger'; label = 'Not added to Vercel'; }
  else if (attached && !attached.verified) { tone = 'warning'; label = 'Waiting for Vercel verification'; }
  else if (dnsReady) { tone = 'success'; label = attached ? 'Live' : 'DNS points to Vercel'; }

  // Only what is still missing: the routing record until DNS points at
  // Vercel, and Vercel's ownership records until it has verified the domain.
  const pendingRecords: DnsRecord[] = [
    ...(dnsReady ? [] : [record]),
    ...(attached && !attached.verified ? attached.verification : []).map((v) => ({
      type: v.type, name: v.domain, value: v.value,
    })),
  ];

  return { tone, label, current, pendingRecords, vercel, vercelConfigured: !!env };
}

/**
 * Whether the domain is confirmed live: the hosting has it attached and
 * verified and no records are missing. DNS pointing the right way alone
 * (no Vercel credentials, or Vercel unreachable) is not confirmation.
 */
export function isConfirmedLive(status: Pick<CustomDomainStatus, 'vercel' | 'pendingRecords'>): boolean {
  return status.vercel?.state === 'attached' && status.vercel.verified && status.pendingRecords.length === 0;
}
