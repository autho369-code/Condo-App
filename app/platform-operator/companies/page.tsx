import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Alert } from '@/components/ui/shell';
import { StatusChip, type Tone } from '@/components/operations/status-chip';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { date, money } from '@/lib/utils';
import { archiveCompany, createCompanyWithAdmin, reactivateCompany, suspendCompany } from './actions';

export const dynamic = 'force-dynamic';

// Spec statuses: Active, Trial, Suspended, Past Due, Cancelled (+ Archived)
function companyStatus(portfolio: any, sub: any): { label: string; tone: Tone } {
  if (portfolio.archived_at) return { label: 'Archived', tone: 'neutral' };
  if (portfolio.suspended_at) return { label: 'Suspended', tone: 'danger' };
  switch (sub?.status) {
    case 'active': return { label: 'Active', tone: 'success' };
    case 'trialing': return { label: 'Trial', tone: 'info' };
    case 'past_due': return { label: 'Past Due', tone: 'danger' };
    case 'canceled':
    case 'expired': return { label: 'Cancelled', tone: 'neutral' };
    case 'paused': return { label: 'Paused', tone: 'warning' };
    default: return { label: 'Not configured', tone: 'neutral' };
  }
}

function healthBadge(score: number | null | undefined) {
  if (score === null || score === undefined) return <span className="text-xs text-gray-400">—</span>;
  const tone: Tone = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'danger';
  return <StatusChip tone={tone}>{score}%</StatusChip>;
}

const BANNERS: Record<string, { title: string; body?: string; tone?: 'success' | 'warning' }> = {
  created: { title: 'Company created', body: 'The company has been provisioned and the admin welcome email has been queued.' },
  archived: { title: 'Company archived successfully.', body: 'All logins are disabled. Association data, billing records, and audit logs are preserved.' },
  suspended: { title: 'Company suspended', tone: 'warning' },
  reactivated: { title: 'Company reactivated' },
};

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;

  const [
    { data: portfolios },
    { data: subscriptions },
    { data: admins },
    { data: associations },
    { data: healthRows },
    { data: invoices },
  ] = await Promise.all([
    db.from('portfolios').select('id, company_name, slug, created_at, suspended_at, suspension_reason, archived_at').order('company_name'),
    db.from('subscriptions').select('portfolio_id, tier, status, seats_included, seats_used, units_limit, price_monthly_cents'),
    db.from('profiles').select('id, email, full_name, portfolio_id').eq('hoa_role', 'company_admin'),
    db.from('associations').select('id, portfolio_id, unit_count').is('archived_at', null),
    db.from('v_company_health').select('*'),
    db.from('invoices').select('id, portfolio_id, paid_at, total_cents').eq('status', 'paid').order('paid_at', { ascending: false }),
  ]);

  // Build lookup maps
  const subMap = new Map<string, any>();
  (subscriptions ?? []).forEach((s: any) => subMap.set(s.portfolio_id, s));

  const adminMap = new Map<string, any>();
  (admins ?? []).forEach((a: any) => adminMap.set(a.portfolio_id, a));

  const assocByPortfolio = new Map<string, { count: number; units: number }>();
  (associations ?? []).forEach((a: any) => {
    const cur = assocByPortfolio.get(a.portfolio_id) || { count: 0, units: 0 };
    cur.count += 1;
    cur.units += Number(a.unit_count ?? 0);
    assocByPortfolio.set(a.portfolio_id, cur);
  });

  const healthMap = new Map<string, number>();
  (healthRows ?? []).forEach((h: any) => {
    if (h.portfolio_id && h.health_score !== undefined) healthMap.set(h.portfolio_id, h.health_score);
  });

  const lastPaymentMap = new Map<string, any>();
  (invoices ?? []).forEach((inv: any) => {
    if (!lastPaymentMap.has(inv.portfolio_id)) lastPaymentMap.set(inv.portfolio_id, inv);
  });

  const rows = (portfolios ?? []);
  const banner = Object.keys(BANNERS).find((k) => sp[k] === '1');

  return (
    <div className="space-y-7">
      {sp.error && <Alert title="Action failed">{sp.error}</Alert>}
      {banner && (
        <Alert tone={BANNERS[banner].tone ?? 'success'} title={BANNERS[banner].title}>
          {BANNERS[banner].body}
        </Alert>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Management Companies</h1>
          <p className="mt-1 text-sm text-gray-500">
            Platform oversight across every company, their subscriptions, doors, and health.
          </p>
        </div>
      </header>

      {/* ── New Company workflow ─────────────────────────────────────── */}
      <Card id="new-company">
        <CardHeader>
          <CardTitle>New Company</CardTitle>
          <p className="text-xs text-gray-500">
            Creates the company, the company-admin account, a secure invitation link, and queues the welcome email.
          </p>
        </CardHeader>
        <CardBody>
          <form action={createCompanyWithAdmin as any} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="company_name">Company name</Label>
              <Input id="company_name" name="company_name" required />
            </div>
            <div>
              <Label htmlFor="first_name">Admin first name</Label>
              <Input id="first_name" name="first_name" required />
            </div>
            <div>
              <Label htmlFor="last_name">Admin last name</Label>
              <Input id="last_name" name="last_name" required />
            </div>
            <div>
              <Label htmlFor="admin_email">Admin email</Label>
              <Input id="admin_email" name="admin_email" type="email" required />
            </div>
            <div>
              <Label htmlFor="phone_number">Phone number</Label>
              <Input id="phone_number" name="phone_number" type="tel" required />
            </div>
            <div>
              <Label htmlFor="tier">Plan</Label>
              <select id="tier" name="tier" required className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="core">Core</option>
                <option value="plus">Plus</option>
                <option value="max">Max</option>
              </select>
            </div>
            <div>
              <Label htmlFor="max_units">Maximum units</Label>
              <Input id="max_units" name="max_units" type="number" min={1} required />
            </div>
            <div className="col-span-full">
              <Button type="submit">Create Company &amp; Send Invitation</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* ── Company directory ────────────────────────────────────────── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-950">Company directory</h2>
          <p className="text-sm text-gray-500">{rows.length} companies</p>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Company</TH>
              <TH>Admin</TH>
              <TH>Plan</TH>
              <TH className="text-right">Doors</TH>
              <TH className="text-right">Unit Limit</TH>
              <TH className="text-right">Monthly</TH>
              <TH>Last Payment</TH>
              <TH>Health</TH>
              <TH>Status</TH>
              <TH>Actions</TH>
            </TR>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={10} className="py-10 text-center text-gray-500">
                  No companies are visible to this platform operator.
                </TD>
              </TR>
            ) : (
              rows.map((p: any) => {
                const sub = subMap.get(p.id);
                const admin = adminMap.get(p.id);
                const assoc = assocByPortfolio.get(p.id) || { count: 0, units: 0 };
                const healthScore = healthMap.get(p.id);
                const lastPmt = lastPaymentMap.get(p.id);
                const status = companyStatus(p, sub);
                const isArchived = !!p.archived_at;
                const isSuspended = !!p.suspended_at;

                return (
                  <TR key={p.id} className="hover:bg-gray-50">
                    <TD>
                      <Link
                        href={`/platform-operator/companies/${p.id}`}
                        className="font-medium text-gray-900 hover:text-gray-950 hover:underline"
                      >
                        {p.company_name ?? 'Unnamed'}
                      </Link>
                      <div className="mt-0.5 text-xs text-gray-400">{date(p.created_at)}</div>
                    </TD>
                    <TD>
                      {admin ? (
                        <div>
                          <div className="text-sm text-gray-900">{admin.full_name}</div>
                          <div className="text-xs text-gray-500">{admin.email}</div>
                        </div>
                      ) : (
                        <span className="text-xs italic text-gray-400">No admin</span>
                      )}
                    </TD>
                    <TD className="text-xs font-medium uppercase">{sub?.tier || '—'}</TD>
                    <TD className="text-right tabular-nums">{assoc.units}</TD>
                    <TD className="text-right tabular-nums">{sub?.units_limit ?? '—'}</TD>
                    <TD className="text-right tabular-nums">
                      {sub?.price_monthly_cents ? money(sub.price_monthly_cents / 100) : '—'}
                    </TD>
                    <TD>
                      {lastPmt ? (
                        <div>
                          <div className="text-sm tabular-nums">{date(lastPmt.paid_at)}</div>
                          <div className="text-xs tabular-nums text-gray-500">{money((lastPmt.total_cents ?? 0) / 100)}</div>
                        </div>
                      ) : (
                        <span className="text-xs italic text-gray-400">None</span>
                      )}
                    </TD>
                    <TD>{healthBadge(healthScore)}</TD>
                    <TD><StatusChip tone={status.tone}>{status.label}</StatusChip></TD>
                    <TD>
                      <div className="flex flex-wrap items-center gap-1">
                        <Link href={`/platform-operator/companies/${p.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                        <Link href={`/platform-operator/companies/${p.id}#billing`}>
                          <Button variant="ghost" size="sm">Billing</Button>
                        </Link>
                        {!isArchived && (
                          isSuspended ? (
                            <form action={reactivateCompany as any}>
                              <input type="hidden" name="portfolio_id" value={p.id} />
                              <input type="hidden" name="return_to" value="/platform-operator/companies" />
                              <Button type="submit" variant="ghost" size="sm">Reactivate</Button>
                            </form>
                          ) : (
                            <form action={suspendCompany as any}>
                              <input type="hidden" name="portfolio_id" value={p.id} />
                              <input type="hidden" name="return_to" value="/platform-operator/companies" />
                              <Button type="submit" variant="ghost" size="sm">Suspend</Button>
                            </form>
                          )
                        )}
                        {!isArchived && (
                          <form action={archiveCompany as any}>
                            <input type="hidden" name="portfolio_id" value={p.id} />
                            <Button type="submit" variant="ghost" size="sm" className="text-red-600 hover:text-red-700">Delete</Button>
                          </form>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })
            )}
          </tbody>
        </Table>
        <p className="text-xs text-gray-400">
          Delete performs a soft archive: logins are disabled, while association data, billing records, and audit logs are preserved.
          Plan changes, additional admin invites, and password resets live on each company&apos;s detail page.
        </p>
      </section>
    </div>
  );
}
