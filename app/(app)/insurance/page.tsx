import Link from 'next/link';
import { Plus, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function InsurancePage() {
  await requireStaff();
  const supabase = await createClient();

  const { data: policies } = await (supabase as any)
    .from('v_upcoming_expirations')
    .select('*')
    .order('expiration_date', { ascending: true });

  const rows = policies ?? [];
  const expiring30 = rows.filter((r: any) => r.days_remaining <= 30 && r.days_remaining > 0).length;
  const expired = rows.filter((r: any) => r.days_remaining < 0).length;
  const active = rows.filter((r: any) => r.days_remaining > 30).length;

  return (
    <DataWorkspace
      title="Insurance policies"
      description="Track HO6 certificates, coverage amounts, and expiration dates. Policies are auto-flagged 30 days before expiry."
      actions={
        <Link href="/insurance/new">
          <Button><Plus className="h-4 w-4" /> Add policy</Button>
        </Link>
      }
    >
      <div className="space-y-6">
        <MetricStrip
          metrics={[
            { label: 'Active policies', value: active },
            { label: 'Expiring soon (30d)', value: expiring30 },
            { label: 'Expired', value: expired },
            { label: 'Total tracked', value: rows.length },
          ]}
        />

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <EmptyState
              icon={ShieldCheck}
              title="No insurance policies yet"
              description="Add your first HO6 policy to start tracking coverage and expiration dates."
              action={
                <Link href="/insurance/new">
                  <Button><Plus className="h-4 w-4" /> Add first policy</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Owner</TH>
                <TH>Association</TH>
                <TH>Policy #</TH>
                <TH>Insurance Co.</TH>
                <TH>Coverage</TH>
                <TH>Expires</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((p: any) => (
                <TR key={p.id}>
                  <TD className="font-medium text-gray-900">{p.owner_name}</TD>
                  <TD className="text-gray-600">{p.association_name ?? '—'}</TD>
                  <TD className="font-mono text-xs text-gray-600">{p.policy_number}</TD>
                  <TD>{p.insurance_company}</TD>
                  <TD className="tabular-nums">{p.coverage_amount ? `$${Number(p.coverage_amount).toLocaleString()}` : '—'}</TD>
                  <TD>
                    <span className={p.days_remaining <= 30 ? 'font-medium text-red-700' : 'text-gray-700'}>
                      {date(p.expiration_date)}
                    </span>
                    <div className="text-xs text-gray-500">
                      {p.days_remaining > 0 ? `${p.days_remaining} days` : p.days_remaining === 0 ? 'Today' : 'Expired'}
                    </div>
                  </TD>
                  <TD>
                    <StatusChip
                      tone={
                        p.status === 'expired'
                          ? 'danger'
                          : p.status === 'expiring_soon'
                            ? 'warning'
                            : 'success'
                      }
                    >
                      {p.status === 'expiring_soon' ? 'Expiring' : p.status}
                    </StatusChip>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </DataWorkspace>
  );
}
