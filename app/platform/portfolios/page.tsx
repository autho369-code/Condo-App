import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle, CardSubtitle, Stat } from '@/components/ui/card';
import { Input, Label, Field } from '@/components/ui/input';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import {
  formatSeatUsage,
  platformStatus,
  statusClass,
  toCount,
  summarizePortfolioHealth,
  type PortfolioHealthRow,
} from '@/lib/platform/metrics';
import { createClient } from '@/lib/supabase/server';
import { tenantUrl, APEX_DOMAIN } from '@/lib/tenant/resolve';

export const dynamic = 'force-dynamic';

/** Compute a default URL slug from a company name */
function defaultSlugFor(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 32)
    .replace(/-+$/, '');
}

async function provisionPortfolio(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const companyName    = (formData.get('name') as string) ?? '';
  const requestedSlug  = ((formData.get('slug') as string) || '').trim().toLowerCase();
  const customDomain   = ((formData.get('custom_domain') as string) || '').trim().toLowerCase() || null;
  const slug = requestedSlug || defaultSlugFor(companyName);

  // 1. Provision via the existing RPC (unchanged)
  const { data: portfolioId, error } = await (supabase as any).rpc('provision_portfolio', {
    p_company_name: companyName,
    p_first_admin_email: formData.get('email') as string,
    p_first_admin_name: (formData.get('admin_name') as string) || undefined,
    p_tier: (formData.get('tier') as any) || 'core',
    p_seats: parseInt(formData.get('seats') as string) || 5,
    p_trial_days: parseInt(formData.get('trial_days') as string) || 14,
  });
  if (error) return { error: error.message };

  // 2. Stamp the URL extension fields (introduced in 20260510020000_portfolio_url_extensions.sql)
  if (portfolioId) {
    const { error: urlError } = await (supabase as any)
      .from('portfolios')
      .update({ slug, custom_domain: customDomain })
      .eq('id', portfolioId);
    if (urlError) {
      // Provisioning succeeded but URL extension failed — surface clearly so
      // the operator can correct the slug from the detail page.
      console.warn('[provisionPortfolio:url-extension]', urlError.message);
    }
  }

  revalidatePath('/platform/portfolios');
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

export default async function PortfoliosPage() {
  const supabase = await createClient();
  // Pull v_portfolio_health joined with portfolios so we can show slug/custom_domain
  const { data: health } = await (supabase as any).from('v_portfolio_health').select('*').order('company_name');
  const { data: portfolios } = await (supabase as any).from('portfolios').select('id, slug, custom_domain');
  const slugByPortfolio = new Map<string, { slug: string; custom_domain: string | null }>();
  (portfolios ?? []).forEach((p: any) => slugByPortfolio.set(p.id, { slug: p.slug, custom_domain: p.custom_domain }));

  const rows = (health ?? []) as PortfolioHealthRow[];
  const summary = summarizePortfolioHealth(rows);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-100 pb-7">
        <div className="max-w-2xl">
          <div className="eyebrow">Platform</div>
          <h1 className="mt-2 font-display text-4xl tracking-editorial text-ink-900">Clients</h1>
          <p className="mt-3 text-[15px] text-ink-500 leading-relaxed">
            Platform control across every management company, association, seat, and billing state.
            Each client gets their own URL on <span className="font-mono text-ink-700">{APEX_DOMAIN}</span>.
          </p>
        </div>
        <Link href="/platform/system-health" className="text-sm font-medium text-champagne-700 underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500 transition-colors">
          Review platform health →
        </Link>
      </header>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Clients" value={summary.totalClients} sub={`${summary.paidAccounts} paid, ${summary.trialAccounts} trial`} />
        <Stat label="Associations" value={summary.totalAssociations} sub="Association records" />
        <Stat label="Units" value={summary.totalUnits} sub="Across all clients" />
        <Stat label="Seats" value={`${summary.activeSeats} / ${summary.includedSeats || '-'}`} sub="Used seats" />
        <Stat label="Invites" value={summary.pendingInvitations} sub="Pending activation" />
        <Stat label="Alerts" value={summary.alertCount} sub={`${summary.failedLogins24h} failed logins`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provision client</CardTitle>
          <CardSubtitle>
            Create the client shell, first manager admin, tier, seats, trial window — and the URL extension they’ll use to sign in.
          </CardSubtitle>
        </CardHeader>
        <CardBody>
          <form action={provisionPortfolio as any} className="grid gap-5 md:grid-cols-3">
            <Field label="Company name">
              <Input id="name" name="name" required placeholder="Beacon Hill Management" />
            </Field>
            <Field label="First admin email">
              <Input id="email" name="email" type="email" required placeholder="m.devlin@beacon.co" />
            </Field>
            <Field label="Admin name (optional)">
              <Input id="admin_name" name="admin_name" placeholder="Margaret Devlin" />
            </Field>

            <Field label="URL slug" hint={`Live at https://{slug}.${APEX_DOMAIN}/login. Leave blank to derive from company name.`}>
              <Input id="slug" name="slug" placeholder="beacon" pattern="^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])$" />
            </Field>
            <Field label="Custom domain (optional)" hint="A vanity domain pointed at Vercel via CNAME. Leave blank for now.">
              <Input id="custom_domain" name="custom_domain" type="text" placeholder="app.managebeacon.com" />
            </Field>
            <Field label="Tier">
              <select
                id="tier"
                name="tier"
                className="h-10 w-full rounded-md border border-ink-200 bg-white px-3.5 text-sm text-ink-900 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60 transition-colors"
              >
                <option value="core">Core</option>
                <option value="plus">Plus</option>
                <option value="max">Max</option>
              </select>
            </Field>
            <Field label="Seats">
              <Input id="seats" name="seats" type="number" defaultValue={5} min={1} />
            </Field>
            <Field label="Trial days">
              <Input id="trial_days" name="trial_days" type="number" defaultValue={14} min={0} />
            </Field>
            <div className="md:col-span-3">
              <Button type="submit" variant="primary">Provision client</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-2xl tracking-editorial text-ink-900">Client directory</h2>
          <p className="text-sm text-ink-500">Drill into a client to review associations, owners, users, and billing.</p>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Client</TH>
              <TH>URL</TH>
              <TH>Tier</TH>
              <TH>Status</TH>
              <TH className="text-right">Associations</TH>
              <TH className="text-right">Units</TH>
              <TH className="text-right">Seats</TH>
              <TH className="text-right">Pending</TH>
            </TR>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={8} className="py-10 text-center text-ink-500">
                  No clients are visible to this platform operator.
                </TD>
              </TR>
            ) : (
              rows.map((p) => {
                const status = platformStatus(p);
                const meta = slugByPortfolio.get(p.portfolio_id ?? '');
                const slug = meta?.slug ?? null;
                const custom = meta?.custom_domain ?? null;
                return (
                  <TR key={p.portfolio_id} className="hover:bg-cream-50">
                    <TD>
                      <Link
                        href={`/platform/portfolios/${p.portfolio_id}`}
                        className="font-medium text-ink-900 hover:text-champagne-700 transition-colors"
                      >
                        {p.company_name ?? 'Unnamed client'}
                      </Link>
                    </TD>
                    <TD>
                      {custom ? (
                        <a
                          href={`https://${custom}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[12.5px] text-champagne-700 underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500"
                        >
                          {custom}
                        </a>
                      ) : slug ? (
                        <a
                          href={tenantUrl(slug, '/login')}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[12.5px] text-champagne-700 underline decoration-champagne-300 underline-offset-4 hover:decoration-champagne-500"
                        >
                          {slug}.{APEX_DOMAIN}
                        </a>
                      ) : (
                        <span className="text-xs text-ink-400">— no slug —</span>
                      )}
                    </TD>
                    <TD className="uppercase">{p.tier ?? '-'}</TD>
                    <TD>
                      <Badge className={statusClass(status)}>{status.replace(/_/g, ' ')}</Badge>
                    </TD>
                    <TD className="text-right tabular-nums">{p.association_count ?? 0}</TD>
                    <TD className="text-right tabular-nums">{p.unit_count ?? 0}</TD>
                    <TD className="text-right tabular-nums">{formatSeatUsage(p)}</TD>
                    <TD className="text-right tabular-nums">{p.pending_invitations ?? 0}</TD>
                  </TR>
                );
              })
            )}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
