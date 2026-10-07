import { NextRequest, NextResponse } from 'next/server';
import { GUIDES } from '@/lib/guides/content';
import { renderGuidePdf, type GuideBranding } from '@/lib/guides/pdf';
import { createClient } from '@/lib/supabase/server';
import { tenantWorkspaceUrl } from '@/lib/tenant/host';
import { tenantFromHeaders } from '@/lib/tenant/resolve';

// The staff guides, generated per company so each client sees its own name
// and sign-in address (white label). Public, like the static files they
// replace: invite emails link them before the reader has an account, and
// they hold no company data beyond its name.
export const dynamic = 'force-dynamic';

const FILES: Record<string, keyof typeof GUIDES> = {
  'manager-runbook.pdf': 'manager-runbook',
  'company-admin-guide.pdf': 'company-admin-guide',
};

// Links in emails sent before the guides were generated per company.
const RENAMED: Record<string, string> = {
  'Portier369-Manager-Runbook.pdf': 'manager-runbook.pdf',
  'Portier369-Manager-Runbook.docx': 'manager-runbook.pdf',
  'Portier369-Company-Admin-Guide.pdf': 'company-admin-guide.pdf',
  'Portier369-Company-Admin-Guide.docx': 'company-admin-guide.pdf',
};

/** Sign-in always goes through the Portier369 sign-in (Supabase) at the company's workspace address. */
function signInAddress(slug: string | null): string | null {
  if (!slug) return null;
  const url = new URL(tenantWorkspaceUrl(slug, '/login'));
  return `${url.host}${url.pathname}`;
}

async function branding(request: NextRequest): Promise<GuideBranding> {
  const tenant = tenantFromHeaders(request.headers);
  // Read the name header itself: tenantFromHeaders substitutes the platform
  // name when it is missing, which must never head a company's guide.
  if (tenant) return { companyName: request.headers.get('x-portfolio-name') ? tenant.companyName : null, signInAddress: signInAddress(tenant.slug) };
  // On the platform address: the signed-in user's own company, if any.
  try {
    const { data } = await ((await createClient()) as any).rpc('me');
    const portfolio = data?.auth_user_id ? data.portfolio : null;
    if (portfolio?.company_name) {
      return { companyName: portfolio.company_name, signInAddress: signInAddress(portfolio.slug ?? null) };
    }
  } catch {
    // Signed out or unavailable: neutral wording below.
  }
  return { companyName: null, signInAddress: null };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const renamed = RENAMED[file];
  if (renamed) {
    const url = request.nextUrl.clone();
    url.pathname = `/manuals/${renamed}`;
    return NextResponse.redirect(url, 308);
  }
  const key = FILES[file];
  if (!key) return new NextResponse('Not found', { status: 404 });

  const pdf = renderGuidePdf(GUIDES[key], await branding(request));
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${file}"`,
      // Branded per company and per signed-in user: never shared caches.
      'Cache-Control': 'private, no-store',
    },
  });
}
