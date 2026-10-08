// Public token pages (signing, vendor uploads) belong to one company: the
// company whose request the token opens. On another company's address the
// token reads as invalid (it names no company), as /invite refuses an
// invitation from a different workspace. On the platform address, which has
// no company, the page moves to the company's own address so it opens under
// the company's name; links in emails already point there, so this is only
// older or hand-copied links.
import { tenantFromHeaders } from '@/lib/tenant/resolve';
import { siteUrl } from '@/lib/url/site-url';
import { COMPANY_ADDRESS_COLUMNS, apexDomain, classifyTenantHost, companyUrl, type CompanyAddress } from '@/lib/tenant/host';

/**
 * False only when the request came in on a company's address and the token
 * belongs to a different company (or to none).
 */
export function tokenMatchesAddress(headers: Headers, portfolioId: string | null | undefined): boolean {
  const tenant = tenantFromHeaders(headers);
  if (!tenant) return true;
  return Boolean(portfolioId) && tenant.portfolioId === portfolioId;
}

/**
 * The company's own URL for `path` when the request came in on the platform
 * address and the company has an address of its own; otherwise null (stay).
 * Only moves from the platform address to a company address, so it can't loop.
 */
export function companyAddressRedirect(
  headers: Headers,
  company: CompanyAddress | null | undefined,
  path: string,
  platformOrigin = siteUrl(),
  apex = apexDomain(),
): string | null {
  if (!company || tenantFromHeaders(headers)) return null;
  const here = classifyTenantHost(headers.get('host'), apex);
  if (here.kind !== 'platform' && here.kind !== 'www') return null;
  const target = companyUrl(company, path, platformOrigin, apex);
  const kind = classifyTenantHost(new URL(target).host, apex).kind;
  return kind === 'subdomain' || kind === 'custom-domain' ? target : null;
}

/** The page's ?error= / ?done= notice, kept when it moves to the company's address. */
export function noticeQuery(sp: { error?: string; done?: string }): string {
  const q = new URLSearchParams();
  if (sp.error) q.set('error', sp.error);
  if (sp.done) q.set('done', sp.done);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** The company's address columns, for companyAddressRedirect (null once archived). */
export async function companyAddressOf(service: any, portfolioId: string | null | undefined): Promise<CompanyAddress | null> {
  if (!portfolioId) return null;
  // An archived company's address no longer opens; stay on the platform address.
  const { data } = await service.from('portfolios').select(COMPANY_ADDRESS_COLUMNS).eq('id', portfolioId).is('archived_at', null).maybeSingle();
  return data ?? null;
}

/** The company a signing token belongs to, read without recording a view. */
export async function signingTokenPortfolio(service: any, tokenHash: string): Promise<string | null> {
  const { data: signer } = await service.from('signature_signers').select('request_id').eq('token_hash', tokenHash).maybeSingle();
  if (!signer?.request_id) return null;
  const { data: request } = await service.from('signature_requests').select('portfolio_id').eq('id', signer.request_id).maybeSingle();
  return request?.portfolio_id ?? null;
}
