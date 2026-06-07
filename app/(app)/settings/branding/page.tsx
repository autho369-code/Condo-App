import { createClient } from '@/lib/supabase/server';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Section } from '@/components/workspace/shell';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

async function saveBranding(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const me = await requirePortfolioAdmin();

  const { error } = await (supabase as any)
    .from('portfolios')
    .update({
      company_name: formData.get('company_name') as string,
      brand_color: formData.get('brand_color') as string || '#10B981',
      logo_url: formData.get('logo_url') as string || null,
      support_email: formData.get('support_email') as string || null,
      support_phone: formData.get('support_phone') as string || null,
      public_website: formData.get('public_website') as string || null,
    })
    .eq('id', me.portfolio.id);

  if (error) return { error: error.message };
  revalidatePath('/settings/branding');
}

export default async function BrandingPage() {
  const me = await requirePortfolioAdmin();
  const supabase = await createClient();

  const { data: portfolio } = await (supabase as any)
    .from('portfolios')
    .select('company_name, brand_color, logo_url, support_email, support_phone, public_website')
    .eq('id', me.portfolio.id)
    .single();

  const p = portfolio ?? {};

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-8 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Company branding</h1>
        <p className="mt-1 text-sm text-ink-500">
          Your logo, colors, and contact info appear on owner portals, statements, and emails — so residents see your brand, not ours.
        </p>
      </div>

      <form action={saveBranding as any} className="space-y-6">
        <Section title="Company identity" padded>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="company_name">Company name</Label>
              <Input id="company_name" name="company_name" defaultValue={p.company_name ?? ''} required />
              <p className="mt-1 text-xs text-ink-400">Shown in the sidebar, portal header, and all owner communications.</p>
            </div>

            <div>
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input id="logo_url" name="logo_url" defaultValue={p.logo_url ?? ''} placeholder="https://your-company.com/logo.png" />
              <p className="mt-1 text-xs text-ink-400">Upload to Supabase Storage and paste the public URL here.</p>
            </div>

            <div>
              <Label htmlFor="brand_color">Brand color</Label>
              <div className="flex items-center gap-2">
                <input type="color" id="brand_color_picker" defaultValue={p.brand_color ?? '#10B981'} className="h-10 w-10 cursor-pointer rounded border" />
                <Input id="brand_color" name="brand_color" defaultValue={p.brand_color ?? '#10B981'} className="flex-1 font-mono" />
              </div>
            </div>

            <div>
              <Label htmlFor="support_email">Support email</Label>
              <Input id="support_email" name="support_email" type="email" defaultValue={p.support_email ?? ''} placeholder="help@yourcompany.com" />
            </div>

            <div>
              <Label htmlFor="support_phone">Support phone</Label>
              <Input id="support_phone" name="support_phone" type="tel" defaultValue={p.support_phone ?? ''} placeholder="(555) 555-5555" />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="public_website">Public website</Label>
              <Input id="public_website" name="public_website" defaultValue={p.public_website ?? ''} placeholder="https://yourcompany.com" />
            </div>
          </div>
        </Section>

        {/* Live preview */}
        <Section title="Portal preview" padded>
          <div className="rounded-lg border border-ink-200 bg-cream-50 p-6">
            <div className="flex items-center gap-3">
              {p.logo_url ? (
                <img src={p.logo_url} alt="Logo" className="h-10 w-10 rounded object-contain" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded font-bold text-white" style={{ backgroundColor: p.brand_color ?? '#10B981' }}>
                  {(p.company_name ?? 'P').charAt(0)}
                </div>
              )}
              <div>
                <div className="font-display text-lg text-ink-900">{p.company_name ?? 'Your Company'}</div>
                <div className="text-xs text-ink-500">Property Management Portal</div>
              </div>
            </div>
            <div className="mt-4 rounded-md p-3 text-sm" style={{ backgroundColor: `${p.brand_color ?? '#10B981'}15`, borderLeft: `3px solid ${p.brand_color ?? '#10B981'}` }}>
              This is how your accent color will appear in CTAs, links, and highlights throughout the owner portal and board dashboard.
            </div>
          </div>
        </Section>

        <div className="flex items-center gap-3">
          <Button type="submit" size="lg">Save branding</Button>
          <a href="/portal" target="_blank" className="text-sm text-champagne-700 hover:underline">
            Preview owner portal →
          </a>
        </div>
      </form>
    </div>
  );
}
