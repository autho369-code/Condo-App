// A company's own domain (portal.stellarpropertygroup.com) in place of its
// <slug>.<apex> workspace address. The domain is stored on
// portfolios.custom_domain (set by platform_set_portfolio_custom_domain, which
// repeats the validation below) and must also be attached to the Vercel
// project and pointed at Vercel in the company's DNS before it serves.
import { promises as dns } from 'node:dns';
import { getDomain } from 'tldts';
import { apexDomain, normalizeHostname } from '@/lib/tenant/host';

const HOSTNAME = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

export type CustomDomainInput = { ok: true; domain: string | null } | { ok: false; error: string };

/** Validate a domain typed by an admin; an empty value clears the domain. */
export function parseCustomDomain(value: unknown, apex = apexDomain()): CustomDomainInput {
  const raw = String(value ?? '').trim().toLowerCase().replace(/\.+$/, '');
  if (!raw) return { ok: true, domain: null };
  if (raw.length > 253 || !HOSTNAME.test(raw)) {
    return { ok: false, error: 'Enter a domain such as portal.yourcompany.com (no https:// and no path).' };
  }
  const platform = [normalizeHostname(apex), 'portier369.com', 'vercel.app'];
  if (platform.some((p) => raw === p || raw.endsWith(`.${p}`)) || raw.endsWith('.localhost')) {
    return { ok: false, error: `"${raw}" is a platform address. Use the company's own domain.` };
  }
  return { ok: true, domain: raw };
}

/**
 * A root domain (yourcompany.com, yourcompany.co.uk) can't hold a CNAME; it
 * needs an A record. The registrable boundary comes from the public suffix
 * list, so multi-label suffixes such as co.uk are handled.
 */
export function isRootDomain(domain: string): boolean {
  const registrable = getDomain(domain);
  return registrable ? registrable === domain : domain.split('.').length === 2;
}

/** Vercel's documented defaults when its API isn't connected. */
export const DEFAULT_CNAME_TARGET = 'cname.vercel-dns.com';
export const DEFAULT_A_RECORD = '76.76.21.21';

export type DnsRecord = { type: string; name: string; value: string };

/** The record the company adds at its DNS provider. */
export function requiredDnsRecord(
  domain: string,
  recommended?: { cname?: string | null; ipv4?: string | null },
): DnsRecord {
  if (isRootDomain(domain)) return { type: 'A', name: domain, value: recommended?.ipv4 || DEFAULT_A_RECORD };
  return {
    type: 'CNAME',
    name: domain,
    value: (recommended?.cname || DEFAULT_CNAME_TARGET).replace(/\.$/, ''),
  };
}

/** Whether a resolved CNAME/A answer is one of Vercel's. */
export function pointsAtVercel(answer: { cnames: string[]; ipv4: string[] }, expected: DnsRecord): boolean {
  const cnames = answer.cnames.map((c) => c.toLowerCase().replace(/\.$/, ''));
  if (cnames.some((c) => c === expected.value || /(^|\.)vercel-dns(-\d+)?\.com$/.test(c))) return true;
  return answer.ipv4.includes(expected.value) || answer.ipv4.includes(DEFAULT_A_RECORD);
}

/** What public DNS currently answers for the domain (empty lists when nothing). */
export async function lookupDomain(domain: string, timeoutMs = 3000): Promise<{ cnames: string[]; ipv4: string[] }> {
  const within = <T>(p: Promise<T>) => Promise.race([
    p.catch(() => [] as unknown as T),
    new Promise<T>((resolve) => setTimeout(() => resolve([] as unknown as T), timeoutMs)),
  ]);
  const [cnames, ipv4] = await Promise.all([within(dns.resolveCname(domain)), within(dns.resolve4(domain))]);
  return { cnames, ipv4 };
}

// ── Vercel project domains (optional) ────────────────────────────────────
// With VERCEL_API_TOKEN and VERCEL_PROJECT_ID set (VERCEL_TEAM_ID for a team
// project), saving a domain attaches it to the project and the status comes
// from Vercel. Without them, the domain is added in Vercel by hand.

type VercelEnv = { token: string; projectId: string; teamId: string | null };

export function vercelDomainsEnv(): VercelEnv | null {
  const token = process.env.VERCEL_API_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  if (!token || !projectId) return null;
  return { token, projectId, teamId: process.env.VERCEL_TEAM_ID?.trim() || null };
}

async function vercel(env: VercelEnv, path: string, init?: RequestInit): Promise<{ status: number; body: any }> {
  const url = new URL(`https://api.vercel.com${path}`);
  if (env.teamId) url.searchParams.set('teamId', env.teamId);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Attach the domain to the Vercel project (no-op when it is already attached). */
export async function attachDomainToVercel(env: VercelEnv, domain: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const project = encodeURIComponent(env.projectId);
    const existing = await vercel(env, `/v9/projects/${project}/domains/${encodeURIComponent(domain)}`);
    if (existing.status === 200) return { ok: true };
    const added = await vercel(env, `/v10/projects/${project}/domains`, { method: 'POST', body: JSON.stringify({ name: domain }) });
    if (added.status >= 200 && added.status < 300) return { ok: true };
    return { ok: false, error: added.body?.error?.message || `Vercel answered ${added.status}.` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Vercel could not be reached.' };
  }
}

export type VercelDomainStatus =
  | { state: 'not-attached' }
  | { state: 'attached'; verified: boolean; misconfigured: boolean | null;
      verification: Array<{ type: string; domain: string; value: string }>;
      recommended: { cname: string | null; ipv4: string | null } }
  | { state: 'error'; error: string };

export async function vercelDomainStatus(env: VercelEnv, domain: string): Promise<VercelDomainStatus> {
  try {
    const name = encodeURIComponent(domain);
    const [project, config] = await Promise.all([
      vercel(env, `/v9/projects/${encodeURIComponent(env.projectId)}/domains/${name}`),
      vercel(env, `/v6/domains/${name}/config`),
    ]);
    if (project.status === 404) return { state: 'not-attached' };
    if (project.status !== 200) return { state: 'error', error: project.body?.error?.message || `Vercel answered ${project.status}.` };
    const cfg = config.status === 200 ? config.body : null;
    return {
      state: 'attached',
      verified: !!project.body?.verified,
      misconfigured: cfg ? !!cfg.misconfigured : null,
      verification: Array.isArray(project.body?.verification) ? project.body.verification : [],
      recommended: {
        cname: cfg?.recommendedCNAME?.[0]?.value ?? null,
        ipv4: cfg?.recommendedIPv4?.[0]?.value?.[0] ?? null,
      },
    };
  } catch (e: any) {
    return { state: 'error', error: e?.message || 'Vercel could not be reached.' };
  }
}
