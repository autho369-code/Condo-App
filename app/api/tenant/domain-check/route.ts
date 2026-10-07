import { NextRequest, NextResponse } from 'next/server';
import { classifyTenantHost } from '@/lib/tenant/host';
import { domainProof } from '@/lib/tenant/domain-proof';

// Public. Answers on a company's custom domain with a proof tied to the
// company the request resolved to (middleware sets these headers and strips
// any a client sends), so the verify-domains job can confirm the domain
// serves that company. Reveals nothing else.
export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const host = request.headers.get('x-tenant-host');
  const portfolioId = request.headers.get('x-portfolio-id');
  const resolved = request.headers.get('x-tenant-state') === 'resolved';
  if (!resolved || !host || !portfolioId || classifyTenantHost(host).kind !== 'custom-domain') {
    return NextResponse.json({ error: 'Not a company domain' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const proof = domainProof(portfolioId, host);
  if (!proof) {
    return NextResponse.json({ error: 'Domain check is not configured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json({ proof }, { headers: { 'Cache-Control': 'no-store' } });
}
