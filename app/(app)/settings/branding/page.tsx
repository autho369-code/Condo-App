import { createClient } from '@/lib/supabase/server';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { ColorField } from '@/components/ui/color-field';
import { Alert, Breadcrumb, PageHeader, PageShell } from '@/components/ui/shell';
import { Section } from '@/components/workspace/shell';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isHexColor, normalizeCompanyLogoUrl, normalizeSupportEmail, normalizeWebsiteUrl } from '@/lib/company-admin/settings';

export const dynamic = 'force-dynamic';

async function saveBranding(formData: FormData) {
  'use server';
  const fail = (message: string): never => redirect('/settings/branding?error=' + encodeURIComponent(message));
  const supabase = await createClient();
  const me = await requirePortfolioAdmin();
  const portfolioId: string | undefined = me.portfolio?.id;
  if (!portfolioId) fail('Your account is not linked to a company.');

  // Never store a blank or whitespace-only company name: it heads every
  // client-facing page, email and document.
  const companyName = String(formData.get('company_name') ?? '').trim().slice(0, 200);
  if (!companyName) fail('Company name is required.');

  // The color is sent to every page as a request header: #RRGGBB only.
  const brandColor = String(formData.get('brand_color') ?? '').trim() || '#10B981';
  if (!isHexColor(brandColor)) fail('Brand color must be a hex color like #10B981.');

  const logo = normalizeCompanyLogoUrl(formData.get('logo_url'));
  if ('error' in logo) fail(logo.error);
  const site = normalizeWebsiteUrl(formData.get('public_website'));
  if ('error' in site) fail(site.error);
  const support = normalizeSupportEmail(formData.get('support_email'));
  if ('error' in support) fail(support.error);

  const { data: saved, error } = await (supabase as any)
    .from('portfolios')
    .update({
      company_name: companyName,
      brand_color: brandColor,
      logo_url: (logo as { logoUrl: string | null }).logoUrl,
      support_email: (support as { email: string | null }).email,
      support_phone: (formData.get('support_phone') as string)?.trim() || null,
      public_website: (site as { website: string | null }).website,
    })
    .eq('id', portfolioId)
    .select('id');

  if (error) fail(error.message);
  if (!saved?.length) fail('Branding was not saved: your account cannot edit this company.');
  revalidatePath('/settings/branding');
  redirect('/settings/branding?saved=1');
}

export default async function BrandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requirePortfolioAdmin();
  const { error: errorMessage, saved } = await searchParams;
  const supabase = await createClient();

  const { data: portfolio } = await (supabase as any)
    .from('portfolios')
    .select('company_name, brand_color, logo_url, support_email, support_phone, public_website')
    .eq('id', me.portfolio.id)
    .single();

  const p = portfolio ?? {};
  const previewColor = typeof p.brand_color === 'string' && isHexColor(p.brand_color) ? p.brand_color : '#10B981';

  return (
    <PageShell className="max-w-3xl">
      <Breadcrumb items={[{ label: 'Settings', href: '/settings' }, { label: 'Branding' }]} />
      <PageHeader
        title="Company branding"
        description="Your logo, colors, and contact info appear on owner portals, statements, and emails — so residents see your brand."
      />

      {errorMessage && <Alert tone="danger" title="Could not save branding:" className="mb-6">{errorMessage}</Alert>}
      {saved && !errorMessage && <Alert tone="success" title="Branding saved." className="mb-6" />}

      <form action={saveBranding as any} className="space-y-6">
        <Section title="Company identity" padded>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="company_name">Company name</Label>
              <Input id="company_name" name="company_name" defaultValue={p.company_name ?? ''} required maxLength={200} />
              <p className="mt-1 text-xs text-gray-400">Shown in the sidebar, portal header, and all owner communications.</p>
            </div>

            <div>
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input id="logo_url" name="logo_url" type="url" defaultValue={p.logo_url ?? ''} placeholder="https://your-company.com/logo.png" />
              <p className="mt-1 text-xs text-gray-400">Upload to Supabase Storage and paste the public URL here.</p>
            </div>

            <div>
              <Label htmlFor="brand_color">Brand color</Label>
              <ColorField id="brand_color" name="brand_color" defaultValue={p.brand_color ?? '#10B981'} />
            </div>

            <div>
              <Label htmlFor="support_email">Support email</Label>
              <Input id="support_email" name="support_email" type="email" defaultValue={p.support_email ?? ''} placeholder="help@yourcompany.com" />
            </div>

            <div>
              <Label htmlFor="support_phone">Support phone</Label>
              <Input id="support_phone" name="support_phone" type="tel" defaultValue={p.support_phone ?? ''} placeholder="(555) 555-5555" />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="public_website">Public website</Label>
              <Input id="public_website" name="public_website" type="url" defaultValue={p.public_website ?? ''} placeholder="https://yourcompany.com" />
            </div>
          </div>
        </Section>

        {/* Live preview — intentionally uses the customer's own brand color */}
        <Section title="Portal preview" padded>
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-6">
            <div className="flex items-center gap-3">
              {p.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.logo_url} alt="Logo" className="h-10 w-10 rounded-lg object-contain" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white" style={{ backgroundColor: previewColor }}>
                  {(p.company_name?.trim() || '?').charAt(0)}
                </div>
              )}
              <div>
                <div className="text-lg font-semibold tracking-[-0.01em] text-gray-950">{p.company_name?.trim() || 'Your Company'}</div>
                <div className="text-xs text-gray-500">Property Management Portal</div>
              </div>
            </div>
            <div className="mt-4 rounded-lg p-3 text-sm text-gray-700" style={{ backgroundColor: `${previewColor}15`, borderLeft: `3px solid ${previewColor}` }}>
              This is how your accent color will appear in CTAs, links, and highlights throughout the owner portal and board dashboard.
            </div>
          </div>
        </Section>

        <div className="flex items-center gap-3">
          <Button type="submit" size="lg">Save branding</Button>
          <a href="/portal" target="_blank" className="inline-flex min-h-10 items-center text-sm font-medium text-gray-500 transition-colors hover:text-gray-900">
            Preview owner portal →
          </a>
        </div>
      </form>
    </PageShell>
  );
}
