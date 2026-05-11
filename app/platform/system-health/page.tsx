import Link from 'next/link';

import { Card, CardBody, Stat } from '@/components/ui/card';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { summarizePortfolioHealth, toCount, type PortfolioHealthRow } from '@/lib/platform/metrics';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function PlatformSystemHealthPage() {
  const supabase = await createClient();
  const { data } = await (supabase as any).from('v_portfolio_health').select('*').order('company_name');
  const rows = (data ?? []) as PortfolioHealthRow[];
  const summary = summarizePortfolioHealth(rows);
  const suspended = rows.filter((row) => row.suspended_at).length;
  const seatOverages = rows.filter((row) => toCount(row.seats_included) > 0 && toCount(row.seats_used) > toCount(row.seats_included)).length;
  const alerts = rows.filter((row) => toCount(row.pending_invitations) > 0 || toCount(row.failed_logins_24h) > 0 || row.suspended_at);

  return (
    <div className="space-y-7">
      <header>
        <h1 className="font-display text-4xl tracking-editorial text-ink-900">System Health</h1>
        <p className="mt-2 text-[15px] text-ink-500 leading-relaxed">Platform-level alerts and account health signals.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Alerts" value={summary.alertCount + suspended + seatOverages} sub="Attention signals" />
        <Stat label="Failed logins" value={summary.failedLogins24h} sub="Last 24 hours" />
        <Stat label="Pending invites" value={summary.pendingInvitations} sub="Unaccepted invitations" />
        <Stat label="Seat overages" value={seatOverages} sub="Used seats above plan" />
      </div>

      <Card>
        <CardBody className="p-0">
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Client</TH>
                <TH>Suspension</TH>
                <TH className="text-right">Pending invites</TH>
                <TH className="text-right">Failed logins</TH>
                <TH className="text-right">Seat usage</TH>
              </TR>
            </THead>
            <tbody>
              {alerts.length === 0 ? (
                <TR>
                  <TD colSpan={5} className="py-10 text-center text-ink-500">No platform health alerts right now.</TD>
                </TR>
              ) : (
                alerts.map((row) => (
                  <TR key={row.portfolio_id} className="hover:bg-cream-50">
                    <TD>
                      <Link href={`/platform/portfolios/${row.portfolio_id}`} className="font-medium text-champagne-700 hover:underline">
                        {row.company_name ?? 'Unnamed client'}
                      </Link>
                    </TD>
                    <TD>{row.suspended_at ? 'Suspended' : '-'}</TD>
                    <TD className="text-right">{row.pending_invitations ?? 0}</TD>
                    <TD className={`text-right ${toCount(row.failed_logins_24h) > 0 ? 'font-medium text-red-600' : ''}`}>
                      {row.failed_logins_24h ?? 0}
                    </TD>
                    <TD className="text-right">{row.seats_used ?? 0} / {row.seats_included ?? '-'}</TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
