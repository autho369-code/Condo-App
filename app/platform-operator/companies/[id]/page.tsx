import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/card';
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
  if (s === 'suspended') return <Badge className="bg-red-50 text-red-700 ring-red-200">Suspended</Badge>;
  if (s === 'canceled') return <Badge className="bg-red-50 text-red-700 ring-red-200">Canceled</Badge>;
  return <Badge className="bg-gray-50 text-gray-700 ring-gray-200">{status}</Badge>;
}

async function toggleSuspend(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const id = formData.get('portfolio_id') as string;
  const action = formData.get('action') as string;

  if (action === 'suspend') {
    await (supabase as any).from('portfolios').update({ suspended_at: new Date().toISOString() }).eq('id', id);
  } else {
    await (supabase as any).from('portfolios').update({ suspended_at: null }).eq('id', id);
  }
  revalidatePath(`/platform-operator/companies/${id}`);
  redirect(`/platform-operator/companies/${id}`);
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;

  const [
    { data: portfolio },
    { data: healthRows },
    { data: subscription },
    { data: admins },
    { data: associationsData },
    { data: invoices },
    { data: notes },
  ] = await Promise.all([
    db.from('portfolios').select('id, company_name, slug, tier, created_at, suspended_at, suspension_reason, address_city, address_state, phone_number').eq('id', id).maybeSingle(),
    db.from('v_company_health').select('*').eq('portfolio_id', id).limit(1),
    db.from('subscriptions').select('id, tier, status, billing_email, seats_used, seats_included, associations_limit, units_limit, price_monthly_cents, trial_ends_at, current_period_end').eq('portfolio_id', id).maybeSingle(),
    db.from('profiles').select('id, email, full_name, display_name, hoa_role, last_login_at, mfa_enrolled_at, portfolio_id').eq('portfolio_id', id).eq('hoa_role', 'company_admin'),
    db.from('associations').select('id, name, city, state, unit_count, status').eq('portfolio_id', id).is('archived_at', null).order('name').limit(20),
    db.from('invoices').select('id, number, period_start, period_end, total_cents, status, paid_at, stripe_invoice_url').eq('portfolio_id', id).order('period_start', { ascending: false }).limit(20),
    db.from('portfolio_settings').select('notes').eq('portfolio_id', id).maybeSingle(),
  ]);

  if (!portfolio) notFound();

  const health = (healthRows ?? [])[0];
  const totalDoors = (associationsData ?? []).reduce((sum: number, a: any) => sum + (a.unit_count ?? 0), 0);
  const isSuspended = !!portfolio.suspended_at;

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <div className="text-sm">
          <Link href="/platform-operator/companies" className="text-blue-700 hover:underline">
            Companies
          </Link>
          <span className="px-2 text-gray-300">/</span>
          <span className="text-gray-500">{portfolio.company_name}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">{portfolio.company_name}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Full company profile, subscription, associations, and billing.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <form action={toggleSuspend as any}>
              <input type="hidden" name="portfolio_id" value={id} />
              <input type="hidden" name="action" value={isSuspended ? 'reactivate' : 'suspend'} />
              <Button type="submit" variant={isSuspended ? 'primary' : 'danger'} size="sm">
                {isSuspended ? 'Reactivate' : 'Suspend'}
              </Button>
            </form>
            {statusBadge(subscription?.status)}
          </div>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Stat label="Tier" value={subscription?.tier ?? portfolio.tier ?? '—'} />
        <Stat label="Seats" value={`${subscription?.seats_used ?? 0} / ${subscription?.seats_included ?? '—'}`} />
        <Stat label="Associations" value={associationsData?.length ?? 0} sub={`Limit: ${subscription?.associations_limit ?? '—'}`} />
        <Stat label="Doors" value={totalDoors} sub={`Limit: ${subscription?.units_limit ?? '—'}`} />
        <Stat label="Monthly" value={subscription?.price_monthly_cents ? money(subscription.price_monthly_cents / 100) : '—'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Company info</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-gray-500">Company name</span>
                <div className="font-medium text-gray-950">{portfolio.company_name}</div>
              </div>
              <div>
                <span className="text-gray-500">Slug</span>
                <div className="font-medium text-gray-950">{portfolio.slug ?? '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Created</span>
                <div className="font-medium text-gray-950">{date(portfolio.created_at, 'long')}</div>
              </div>
              <div>
                <span className="text-gray-500">Location</span>
                <div className="font-medium text-gray-950">{[portfolio.address_city, portfolio.address_state].filter(Boolean).join(', ') || '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Phone</span>
                <div className="font-medium text-gray-950">{portfolio.phone_number || '—'}</div>
              </div>
              <div>
                <span className="text-gray-500">Status</span>
                <div>{isSuspended ? <Badge className="bg-red-50 text-red-700 ring-red-200">Suspended</Badge> : <Badge className="bg-green-50 text-green-700 ring-green-200">Active</Badge>}</div>
                {portfolio.suspension_reason && (
                  <div className="text-xs text-red-600 mt-1">{portfolio.suspension_reason}</div>
                )}
              </div>
            </div>
            {health?.health_score !== undefined && (
              <div className="pt-3 border-t border-gray-100">
                <span className="text-gray-500">Health score</span>
                <div className="font-medium text-gray-950">{health.health_score}%</div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Tier</span>
              <span className="font-medium uppercase text-gray-950">{subscription?.tier ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span>{statusBadge(subscription?.status)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Price/month</span>
              <span className="font-medium text-gray-950">{subscription?.price_monthly_cents ? money(subscription.price_monthly_cents / 100) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Seats</span>
              <span className="font-medium text-gray-950">{subscription?.seats_used ?? 0} used / {subscription?.seats_included ?? '—'} included</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Assoc limit</span>
              <span className="font-medium text-gray-950">{subscription?.associations_limit ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Unit limit</span>
              <span className="font-medium text-gray-950">{subscription?.units_limit ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Trial ends</span>
              <span className="font-medium text-gray-950">{date(subscription?.trial_ends_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Period ends</span>
              <span className="font-medium text-gray-950">{date(subscription?.current_period_end)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Billing email</span>
              <span className="font-medium text-gray-950">{subscription?.billing_email ?? '—'}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Admin contacts</CardTitle>
          </CardHeader>
          <CardBody>
            {(admins ?? []).length === 0 ? (
              <p className="text-sm text-gray-500">No company admins found.</p>
            ) : (
              <div className="space-y-3">
                {(admins ?? []).map((admin: any) => (
                  <div key={admin.id} className="flex justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-gray-950">{admin.full_name ?? admin.display_name ?? admin.email}</div>
                      <div className="text-xs text-gray-500">{admin.email}</div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div>Last login {date(admin.last_login_at)}</div>
                      <div>{admin.mfa_enrolled_at ? 'MFA enrolled' : 'No MFA'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Associations ({associationsData?.length ?? 0})</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Property</TH>
                  <TH>Location</TH>
                  <TH className="text-right">Doors</TH>
                </TR>
              </THead>
              <tbody>
                {(associationsData ?? []).length === 0 ? (
                  <TR>
                    <TD colSpan={3} className="text-center text-gray-500">No associations found.</TD>
                  </TR>
                ) : (
                  (associationsData ?? []).map((assoc: any) => (
                    <TR key={assoc.id}>
                      <TD className="font-medium text-gray-950">{assoc.name}</TD>
                      <TD className="text-xs text-gray-500">{[assoc.city, assoc.state].filter(Boolean).join(', ') || '—'}</TD>
                      <TD className="text-right">{assoc.unit_count ?? 0}</TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent invoices</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Invoice</TH>
                <TH>Period</TH>
                <TH className="text-right">Total</TH>
                <TH>Status</TH>
                <TH>Paid</TH>
                <TH></TH>
              </TR>
            </THead>
            <tbody>
              {(invoices ?? []).length === 0 ? (
                <TR>
                  <TD colSpan={6} className="text-center text-gray-500">No invoices found.</TD>
                </TR>
              ) : (
                (invoices ?? []).map((inv: any) => (
                  <TR key={inv.id}>
                    <TD className="font-medium text-gray-950">{inv.number ?? inv.id}</TD>
                    <TD className="text-xs text-gray-500">
                      {date(inv.period_start)} – {date(inv.period_end)}
                    </TD>
                    <TD className="text-right">{money((inv.total_cents ?? 0) / 100)}</TD>
                    <TD>{statusBadge(inv.status)}</TD>
                    <TD className="text-xs text-gray-500">{date(inv.paid_at)}</TD>
                    <TD>
                      {inv.stripe_invoice_url && (
                        <a href={inv.stripe_invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-700 hover:underline">
                          View PDF
                        </a>
                      )}
                    </TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Internal notes</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-500 whitespace-pre-wrap">
            {notes?.notes || 'No internal notes recorded.'}
          </p>
        </CardBody>
      </Card>

      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm">Edit Details</Button>
        <Button variant="secondary" size="sm">Change Plan</Button>
        <Button variant="secondary" size="sm">Mark VIP</Button>
        <Button variant="secondary" size="sm">Mark Churn Risk</Button>
      </div>
    </div>
  );
}
