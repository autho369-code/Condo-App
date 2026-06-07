import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { date, money } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

function statusBadge(status: string | null | undefined) {
  if (!status) return <Badge className="bg-gray-50 text-gray-700 ring-gray-200">Not configured</Badge>;
  const s = status.toLowerCase();
  if (s === 'active') return <Badge className="bg-green-50 text-green-700 ring-green-200">Active</Badge>;
  if (s === 'trialing') return <Badge className="bg-blue-50 text-blue-700 ring-blue-200">Trialing</Badge>;
  if (s === 'past_due') return <Badge className="bg-red-50 text-red-700 ring-red-200">Past Due</Badge>;
  if (s === 'suspended' || s === 'canceled') return <Badge className="bg-red-50 text-red-700 ring-red-200">{status}</Badge>;
  return <Badge className="bg-gray-50 text-gray-700 ring-gray-200">{status}</Badge>;
}

function healthBadge(score: number | null | undefined) {
  if (score === null || score === undefined) return <span className="text-gray-400 text-xs">—</span>;
  if (score >= 80) return <Badge className="bg-green-50 text-green-700 ring-green-200">{score}%</Badge>;
  if (score >= 50) return <Badge className="bg-amber-50 text-amber-700 ring-amber-200">{score}%</Badge>;
  return <Badge className="bg-red-50 text-red-700 ring-red-200">{score}%</Badge>;
}

async function createCompany(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const companyName = formData.get('company_name') as string;
  const adminEmail = formData.get('admin_email') as string;
  const adminName = (formData.get('admin_name') as string) || undefined;
  const tier = (formData.get('tier') as string) || 'core';
  const seats = parseInt(formData.get('seats') as string) || 5;
  const trialDays = parseInt(formData.get('trial_days') as string) || 14;

  const { error } = await (supabase as any).rpc('provision_portfolio', {
    p_company_name: companyName,
    p_first_admin_email: adminEmail,
    p_first_admin_name: adminName,
    p_tier: tier,
    p_seats: seats,
    p_trial_days: trialDays,
  });
  if (error) return { error: error.message };
  revalidatePath('/platform-operator/companies');
  redirect('/platform-operator/companies?created=1');
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const sp = await searchParams;
  const me = await requirePlatformOperator();
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
    db.from('portfolios').select('id, company_name, slug, created_at').order('company_name'),
    db.from('subscriptions').select('portfolio_id, tier, status, seats_included, seats_used, price_monthly_cents'),
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

  return (
    <div className="space-y-7">
      {sp.created === '1' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="font-semibold text-green-900">Company created</h3>
          <p className="text-sm text-green-700 mt-1">The company has been provisioned and admin invitation queued.</p>
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Management Companies</h1>
          <p className="mt-1 text-sm text-gray-500">
            Platform oversight across every company, their subscriptions, doors, and health.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Create company</CardTitle>
          <p className="text-xs text-gray-500">Provision a new portfolio with admin, tier, seats, and trial window.</p>
        </CardHeader>
        <CardBody>
          <form action={createCompany as any} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="company_name">Company name</Label>
              <Input id="company_name" name="company_name" required />
            </div>
            <div>
              <Label htmlFor="admin_email">Admin email</Label>
              <Input id="admin_email" name="admin_email" type="email" required />
            </div>
            <div>
              <Label htmlFor="admin_name">Admin name (optional)</Label>
              <Input id="admin_name" name="admin_name" />
            </div>
            <div>
              <Label htmlFor="tier">Plan</Label>
              <select id="tier" name="tier" className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="core">Core</option>
                <option value="plus">Plus</option>
                <option value="max">Max</option>
              </select>
            </div>
            <div>
              <Label htmlFor="seats">Seats</Label>
              <Input id="seats" name="seats" type="number" defaultValue={5} min={1} />
            </div>
            <div>
              <Label htmlFor="trial_days">Trial days</Label>
              <Input id="trial_days" name="trial_days" type="number" defaultValue={14} min={0} />
            </div>
            <div className="col-span-full">
              <Button type="submit">Create Company</Button>
            </div>
          </form>
        </CardBody>
      </Card>

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
              <TH className="text-right">Associations</TH>
              <TH className="text-right">Monthly</TH>
              <TH>Last Payment</TH>
              <TH>Health</TH>
              <TH>Status</TH>
              <TH></TH>
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

                return (
                  <TR key={p.id} className="hover:bg-gray-50">
                    <TD>
                      <Link
                        href={`/platform-operator/companies/${p.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {p.company_name ?? 'Unnamed'}
                      </Link>
                      <div className="text-xs text-gray-400 mt-0.5">{date(p.created_at)}</div>
                    </TD>
                    <TD>
                      {admin ? (
                        <div>
                          <div className="text-sm text-gray-900">{admin.full_name}</div>
                          <div className="text-xs text-gray-500">{admin.email}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No admin</span>
                      )}
                    </TD>
                    <TD className="uppercase text-xs font-medium">
                      {sub?.tier || '—'}
                    </TD>
                    <TD className="text-right">{assoc.units}</TD>
                    <TD className="text-right">{assoc.count}</TD>
                    <TD className="text-right">
                      {sub?.price_monthly_cents ? money(sub.price_monthly_cents / 100) : '—'}
                    </TD>
                    <TD>
                      {lastPmt ? (
                        <div>
                          <div className="text-sm">{date(lastPmt.paid_at)}</div>
                          <div className="text-xs text-gray-500">{money((lastPmt.total_cents ?? 0) / 100)}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">None</span>
                      )}
                    </TD>
                    <TD>{healthBadge(healthScore)}</TD>
                    <TD>{statusBadge(sub?.status)}</TD>
                    <TD>
                      <div className="flex items-center gap-1">
                        <Link href={`/platform-operator/companies/${p.id}`}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </div>
                    </TD>
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
