import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { Card, CardHeader, CardTitle, CardSubtitle, CardBody } from '@/components/ui/card';
import { Input, Field } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SettingsNav } from '@/components/settings/settings-nav';
import { LogoUpload } from '@/components/settings/logo-upload';
import { updatePortfolioBranding } from '@/lib/rpcs/portfolio';
import { tenantUrl, APEX_DOMAIN } from '@/lib/tenant/resolve';

export const dynamic = 'force-dynamic';

export default async function BrandingSettingsPage() {
  const me = await requirePortfolioAdmin();
  const supabase = await createClient();
  const portfolioId = me.portfolio?.id as string;

  const { data: portfolio } = await (supabase as any)
    .from('portfolios')
    .select('id, slug, custom_domain, logo_url, favicon_url, company_name, address_street, address_city, address_state, address_zip, phone_number, brand_email, billing_email_from, website')
    .eq('id', portfolioId)
    .single();

  const updateBrand = updatePortfolioBranding.bind(null, portfolioId);

  const liveUrl = portfolio?.custom_domain
    ? `https://${portfolio.custom_domain}`
    : portfolio?.slug
    ? tenantUrl(portfolio.slug, '/login')
    : null;

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto px-8 py-8">
      <div className="space-y-7">
        <header className="border-b border-ink-100 pb-7">
          <div className="eyebrow">Settings</div>
          <h1 className="mt-2 font-display text-4xl tracking-editorial text-ink-900">
            Brand identity
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] text-ink-500 leading-relaxed">
            How your management company appears to residents, board members, and
            on every Portier-powered surface — from the sign-in page to outbound
            statements.
          </p>
        </header>

        <SettingsNav />

        <form action={updateBrand as any} className="space-y-7">
          {/* ============ LOGO ============ */}
          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
              <CardSubtitle>
                Shown on the sign-in page, the resident portal header, and the
                operator concierge panel when residents reach you via your URL.
              </CardSubtitle>
            </CardHeader>
            <CardBody>
              <LogoUpload portfolioId={portfolioId} initialUrl={portfolio?.logo_url ?? null} />
            </CardBody>
          </Card>

          {/* ============ FAVICON ============ */}
          <Card>
            <CardHeader>
              <CardTitle>Favicon</CardTitle>
              <CardSubtitle>
                The small mark that appears in the browser tab. Shown to anyone
                who reaches your URL — residents, board members, or your team.
              </CardSubtitle>
            </CardHeader>
            <CardBody>
              <LogoUpload portfolioId={portfolioId} initialUrl={portfolio?.favicon_url ?? null} variant="favicon" />
            </CardBody>
          </Card>

          {/* ============ COMPANY DETAILS ============ */}
          <Card>
            <CardHeader>
              <CardTitle>Company details</CardTitle>
              <CardSubtitle>
                Used on outbound statements, letters, and the resident portal footer.
              </CardSubtitle>
            </CardHeader>
            <CardBody>
              <div className="grid gap-5">
                <Field label="Company name">
                  <Input
                    name="company_name"
                    defaultValue={portfolio?.company_name ?? ''}
                    placeholder="Beacon Hill Management"
                    required
                  />
                </Field>

                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Main phone">
                    <Input
                      name="phone_number"
                      type="tel"
                      defaultValue={portfolio?.phone_number ?? ''}
                      placeholder="(617) 555-0142"
                    />
                  </Field>
                  <Field label="Website">
                    <Input
                      name="website"
                      type="url"
                      defaultValue={portfolio?.website ?? ''}
                      placeholder="https://beacon.co"
                    />
                  </Field>
                </div>

                <Field label="Public-facing email" hint="Where residents can reach your office. Shown on the portal & invoices.">
                  <Input
                    name="brand_email"
                    type="email"
                    defaultValue={portfolio?.brand_email ?? ''}
                    placeholder="info@beacon.co"
                  />
                </Field>

                <Field label="Statement sender email" hint="The 'From:' address on outbound owner statements. Defaults to billing@portier369.com if blank.">
                  <Input
                    name="billing_email_from"
                    type="email"
                    defaultValue={portfolio?.billing_email_from ?? ''}
                    placeholder="billing@beacon.co"
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          {/* ============ ADDRESS ============ */}
          <Card>
            <CardHeader>
              <CardTitle>Office address</CardTitle>
              <CardSubtitle>Used as the return address on printed letters and check stubs.</CardSubtitle>
            </CardHeader>
            <CardBody>
              <div className="grid gap-5">
                <Field label="Street">
                  <Input
                    name="address_street"
                    defaultValue={portfolio?.address_street ?? ''}
                    placeholder="100 Beacon Street, Suite 4"
                    autoComplete="street-address"
                  />
                </Field>
                <div className="grid gap-5 md:grid-cols-3">
                  <Field label="City">
                    <Input
                      name="address_city"
                      defaultValue={portfolio?.address_city ?? ''}
                      placeholder="Boston"
                      autoComplete="address-level2"
                    />
                  </Field>
                  <Field label="State">
                    <Input
                      name="address_state"
                      defaultValue={portfolio?.address_state ?? ''}
                      placeholder="MA"
                      maxLength={2}
                      autoComplete="address-level1"
                    />
                  </Field>
                  <Field label="Zip">
                    <Input
                      name="address_zip"
                      defaultValue={portfolio?.address_zip ?? ''}
                      placeholder="02108"
                      autoComplete="postal-code"
                    />
                  </Field>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* ============ LIVE PREVIEW ============ */}
          <Card>
            <CardHeader>
              <CardTitle>Where this appears</CardTitle>
              <CardSubtitle>
                A preview of how your brand will look on the sign-in screen
                {liveUrl ? <> at <span className="font-mono text-ink-700">{liveUrl}</span></> : null}.
              </CardSubtitle>
            </CardHeader>
            <CardBody>
              <BrandPreview
                companyName={portfolio?.company_name ?? 'Your company name'}
                logoUrl={portfolio?.logo_url ?? null}
              />
              {liveUrl && (
                <div className="mt-5 text-sm text-ink-600">
                  <Link
                    href={liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-champagne-700 underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500 transition-colors"
                  >
                    Open your sign-in page in a new tab →
                  </Link>
                </div>
              )}
            </CardBody>
          </Card>

          {/* ============ SAVE ============ */}
          <div className="flex items-center justify-between border-t border-ink-100 pt-6">
            <p className="text-xs text-ink-500">
              Changes apply to every Portier surface within a few seconds.
            </p>
            <div className="flex gap-3">
              <Link href="/settings"><Button type="button" variant="outline" size="md">Cancel</Button></Link>
              <Button type="submit" size="md" variant="primary">Save brand identity</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// =============================================================================
// Inline preview — mirrors the actual <(auth)/layout> right-side concierge panel
// =============================================================================
function BrandPreview({
  companyName,
  logoUrl,
}: {
  companyName: string;
  logoUrl: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink-100 bg-cream-100 p-2">
      <div className="grid grid-cols-[1fr_1fr] gap-2">
        {/* Form side preview */}
        <div className="rounded-md bg-cream-50 p-5">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-7 w-auto max-w-[120px] object-contain" />
            ) : (
              <span className="font-display text-sm text-ink-900">{companyName}</span>
            )}
            {logoUrl && (
              <span className="font-display text-sm text-ink-900 leading-none">{companyName}</span>
            )}
          </div>
          <div className="eyebrow mt-5">Welcome back</div>
          <div className="mt-1.5 font-display text-xl tracking-editorial text-ink-900">
            Sign in to <span className="italic text-champagne-700">your workspace.</span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-7 rounded-md border border-ink-200 bg-white px-2 text-[11px] leading-7 text-ink-400">
              you@company.com
            </div>
            <div className="h-7 rounded-md border border-ink-200 bg-white px-2 text-[11px] leading-7 text-ink-400">
              ••••••••
            </div>
            <div className="h-7 rounded-md bg-ink-900 text-center text-[11px] font-medium leading-7 text-cream-50">
              Sign in
            </div>
          </div>
        </div>
        {/* Concierge side preview */}
        <div className="relative overflow-hidden rounded-md bg-ink-gradient p-5 text-cream-100">
          <span className="absolute left-0 top-0 h-full w-px bg-champagne-500/40" />
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-champagne-200">
            {companyName}
          </div>
          <div className="mt-3 font-display text-lg leading-tight text-cream-50">
            Welcome back to<br />
            <span className="italic text-champagne-300">{companyName}.</span>
          </div>
          <div className="mt-3 text-[11px] leading-relaxed text-cream-300">
            Sign in to your workspace to settle ledgers, dispatch maintenance,
            and keep boards quietly informed.
          </div>
          <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-sm bg-white/10 text-center">
            <div className="bg-ink-900/60 py-1.5"><div className="font-display text-xs text-cream-50">1,200+</div></div>
            <div className="bg-ink-900/60 py-1.5"><div className="font-display text-xs text-cream-50">$3M+</div></div>
            <div className="bg-ink-900/60 py-1.5"><div className="font-display text-xs text-cream-50">99.98%</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
