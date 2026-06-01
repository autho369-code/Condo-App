import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/card';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { formatSeatUsage, platformStatus, statusClass, type PortfolioHealthRow } from '@/lib/platform/metrics';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

function isOpenStatus(status: string | null | undefined) {
  return !['closed', 'complete', 'completed', 'canceled', 'cancelled', 'cured'].includes((status ?? '').toLowerCase());
}

export default async function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: portfolio }, { data: healthRows }, { data: properties }, { data: owners }, { data: users }, { data: subscription }, { data: workOrders }] =
    await Promise.all([
      (supabase as any)
        .from('portfolios')
        .select('id, company_name, tier, suspended_at, suspension_reason, created_at, address_city, address_state, phone_number')
        .eq('id', id)
        .maybeSingle(),
      (supabase as any).from('v_portfolio_health').select('*').eq('portfolio_id', id).limit(1),
      (supabase as any)
        .from('associations')
        .select('id, name, city, state, unit_count, status, archived_at')
        .eq('portfolio_id', id)
        .is('archived_at', null)
        .order('name')
        .limit(12),
      (supabase as any)
        .from('owners')
        .select('id, full_name, email, phone, portal_activated, portal_login_last_at, archived_at')
        .eq('portfolio_id', id)
        .is('archived_at', null)
        .order('full_name')
        .limit(10),
      (supabase as any)
        .from('profiles')
        .select('id, email, full_name, display_name, hoa_role, role, last_login_at, mfa_required')
        .eq('portfolio_id', id)
        .order('email')
        .limit(10),
      (supabase as any)
        .from('subscriptions')
        .select('id, tier, status, billing_email, seats_used, seats_included, price_monthly_cents, trial_ends_at, current_period_end')
        .eq('portfolio_id', id)
        .maybeSingle(),
      (supabase as any)
        .from('work_orders')
        .select('id, status')
        .eq('portfolio_id', id)
        .is('archived_at', null)
        .limit(500),
    ]);

  if (!portfolio) notFound();

  const associationIds = (properties ?? []).map((property: any) => property.id);
  const { data: violations } = associationIds.length
    ? await (supabase as any).from('violations').select('id, status, association_id').in('association_id', associationIds).is('archived_at', null).limit(500)
    : { data: [] };

  const health = ((healthRows ?? [])[0] ?? {
    portfolio_id: id,
    company_name: portfolio.company_name,
    tier: portfolio.tier,
    suspended_at: portfolio.suspended_at,
    subscription_status: subscription?.status ?? null,
    association_count: properties?.length ?? 0,
    unit_count: (properties ?? []).reduce((sum: number, property: any) => sum + (property.unit_count ?? 0), 0),
    seats_used: subscription?.seats_used ?? 0,
    seats_included: subscription?.seats_included ?? null,
  }) as PortfolioHealthRow;
  const status = platformStatus(health);
  const openWorkOrders = (workOrders ?? []).filter((row: any) => isOpenStatus(row.status)).length;
  const openViolations = (violations ?? []).filter((row: any) => isOpenStatus(row.status)).length;

  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <div className="text-sm">
          <Link href="/platform/portfolios" className="text-blue-700 hover:underline">
            Clients
          </Link>
          <span className="px-2 text-gray-300">/</span>
          <span className="text-slate-400">{portfolio.company_name}</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">{portfolio.company_name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              Client oversight: properties, owners, users, billing, and operational volume.
            </p>
          </div>
          <Badge className={statusClass(status)}>{status.replace(/_/g, ' ')}</Badge>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Properties" value={health.association_count ?? properties?.length ?? 0} sub="Associations" />
        <Stat label="Units" value={health.unit_count ?? 0} sub="Managed units" />
        <Stat label="Owners" value={(owners ?? []).length} sub="First 10 loaded" />
        <Stat label="Users" value={(users ?? []).length} sub="Staff seats" />
        <Stat label="Open work" value={openWorkOrders} sub="Maintenance volume" />
        <Stat label="Open violations" value={openViolations} sub="Compliance volume" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Properties</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <Table className="border-0">
              <THead>
                <TR>
                  <TH>Property</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Units</TH>
                </TR>
              </THead>
              <tbody>
                {(properties ?? []).length === 0 ? (
                  <TR>
                    <TD colSpan={3} className="text-center text-slate-400">No properties found for this client.</TD>
                  </TR>
                ) : (
                  (properties ?? []).map((property: any) => (
                    <TR key={property.id}>
                      <TD>
                        <div className="font-medium text-gray-950">{property.name}</div>
                        <div className="mt-1 text-xs text-slate-400">{[property.city, property.state].filter(Boolean).join(', ')}</div>
                      </TD>
                      <TD>{property.status ?? 'active'}</TD>
                      <TD className="text-right">{property.unit_count ?? 0}</TD>
                    </TR>
                  ))
                )}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing status</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Tier</span>
              <span className="font-medium uppercase text-gray-950">{subscription?.tier ?? portfolio.tier ?? '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Seats</span>
              <span className="font-medium text-gray-950">{formatSeatUsage(subscription ?? health)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Billing email</span>
              <span className="font-medium text-gray-950">{subscription?.billing_email ?? '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Trial ends</span>
              <span className="font-medium text-gray-950">{date(subscription?.trial_ends_at)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">Period ends</span>
              <span className="font-medium text-gray-950">{date(subscription?.current_period_end)}</span>
            </div>
            <div className="rounded border border-dashed border-gray-300 p-3 text-xs text-slate-400">
              Stripe billing is reserved here for the payment integration phase.
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Owners</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {(owners ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">No owners found for this client.</p>
            ) : (
              (owners ?? []).map((owner: any) => (
                <div key={owner.id} className="flex justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium text-gray-950">{owner.full_name}</div>
                    <div className="text-xs text-slate-400">{owner.email ?? owner.phone ?? 'No contact on file'}</div>
                  </div>
                  <Badge className={owner.portal_activated ? 'bg-green-50 text-green-700 ring-green-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}>
                    {owner.portal_activated ? 'portal active' : 'not active'}
                  </Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {(users ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">No staff users found for this client.</p>
            ) : (
              (users ?? []).map((user: any) => (
                <div key={user.id} className="flex justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium text-gray-950">{user.full_name ?? user.display_name ?? user.email}</div>
                    <div className="text-xs text-slate-400">Last login {date(user.last_login_at)}</div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div>{user.hoa_role ?? user.role ?? 'staff'}</div>
                    <div>{user.mfa_required ? 'MFA required' : 'MFA optional'}</div>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
