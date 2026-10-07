import { NextRequest, NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/server/cron-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { domainServesCompany } from '@/lib/tenant/domain-proof';

// Hourly. For each company with a custom domain, checks over HTTPS that the
// domain serves that company and records it in custom_domain_verified_at;
// links in emails and pages use the custom domain only while that is set
// (companyUrl). A failed check clears it, so links fall back to the
// workspace address, which always works.
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const db = createServiceClient() as any;
  const { data: companies, error } = await db
    .from('portfolios')
    .select('id, custom_domain, custom_domain_verified_at')
    .not('custom_domain', 'is', null)
    .is('archived_at', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.all((companies ?? []).map(async (c: any) => {
    const live = await domainServesCompany(c.custom_domain, c.id);
    // Compare-and-set on the domain so a change made during the check is not
    // marked verified (the trigger also clears it when the domain changes).
    const { error: updateError } = await db
      .from('portfolios')
      .update({ custom_domain_verified_at: live ? new Date().toISOString() : null })
      .eq('id', c.id)
      .eq('custom_domain', c.custom_domain);
    if (updateError) console.error('Could not record custom domain check', { portfolioId: c.id, error: updateError.message });
    return { portfolioId: c.id, domain: c.custom_domain, live, recorded: !updateError };
  }));

  return NextResponse.json({ checked: results.length, live: results.filter((r) => r.live).length, results });
}
