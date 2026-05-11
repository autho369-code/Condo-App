import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle, Stat } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
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

export const dynamic = 'force-dynamic';

async function provisionPortfolio(formData: FormData) {
  'use server';
  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('provision_portfolio', {
    p_company_name: formData.get('name') as string,
    p_first_admin_email: formData.get('email') as string,
    p_first_admin_name: (formData.get('admin_name') as string) || undefined,
    p_tier: (formData.get('tier') as any) || 'core',
    p_seats: parseInt(formData.get('seats') as string) || 5,
    p_trial_days: parseInt(formData.get('trial_days') as string) || 14,
  });
  if (error) return { error: error.message };
  revalidatePath('/platform/portfolios');
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

export default async function PortfoliosPage() {
  const supabase = await createClient();
  const { data } = await (supabase as any).from('v_portfolio_health').select('*').order('company_name');
  const rows = (data ?? []) as PortfolioHealthRow[];
  const summary = summarizePortfolioHealth(rows);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">Clients</h1>
          <p className="mt-1 text-sm text-gray-500">
            Platform control across every management company, property, seat, and billing state.
          </p>
        </div>
        <Link href="/platform/system-health" className="text-sm font-medium text-blue-700 hover:underline">
          Review platform health
        </Link>
      </header>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Clients" value={summary.totalClients} sub={`${summary.paidAccounts} paid, ${summary.trialAccounts} trial`} />
        <Stat label="Properties" value={summary.totalProperties} sub="Association records" />
        <Stat label="Units" value={summary.totalUnits} sub="Across all clients" />
        <Stat label="Seats" value={`${summary.activeSeats} / ${summary.includedSeats || '-'}`} sub="Used seats" />
        <Stat label="Invites" value={summary.pendingInvitations} sub="Pending activation" />
        <Stat label="Alerts" value={summary.alertCount} sub={`${summary.failedLogins24h} failed logins`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provision client</CardTitle>
          <p className="text-xs text-gray-500">Create the client shell, first manager admin, tier, seats, and trial window.</p>
        </CardHeader>
        <CardBody>
          <form action={provisionPortfolio as any} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="name">Company name</Label>
              <Input id="name" name="name" required />
            </div>
            <div>
              <Label htmlFor="email">First admin email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="admin_name">Admin name (optional)</Label>
              <Input id="admin_name" name="admin_name" />
            </div>
            <div>
              <Label htmlFor="tier">Tier</Label>
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
              <Button type="submit">Provision</Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-950">Client directory</h2>
          <p className="text-sm text-gray-500">Drill into a client to review properties, owners, users, and billing.</p>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Client</TH>
              <TH>Tier</TH>
              <TH>Status</TH>
              <TH className="text-right">Properties</TH>
              <TH className="text-right">Units</TH>
              <TH className="text-right">Seats</TH>
              <TH className="text-right">Pending invites</TH>
              <TH className="text-right">Failed logins</TH>
            </TR>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={8} className="py-10 text-center text-gray-500">
                  No clients are visible to this platform operator.
                </TD>
              </TR>
            ) : (
              rows.map((p) => {
                const status = platformStatus(p);
                return (
                  <TR key={p.portfolio_id} className="hover:bg-gray-50">
                    <TD>
                      <Link href={`/platform/portfolios/${p.portfolio_id}`} className="font-medium text-blue-700 hover:underline">
                        {p.company_name ?? 'Unnamed client'}
                      </Link>
                    </TD>
                    <TD className="uppercase">{p.tier ?? '-'}</TD>
                    <TD>
                      <Badge className={statusClass(status)}>{status.replace(/_/g, ' ')}</Badge>
                    </TD>
                    <TD className="text-right">{p.association_count ?? 0}</TD>
                    <TD className="text-right">{p.unit_count ?? 0}</TD>
                    <TD className="text-right">{formatSeatUsage(p)}</TD>
                    <TD className="text-right">{p.pending_invitations ?? 0}</TD>
                    <TD className={`text-right ${toCount(p.failed_logins_24h) > 0 ? 'font-medium text-red-600' : ''}`}>
                      {p.failed_logins_24h ?? 0}
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
