import Link from 'next/link';

import { DataWorkspace } from '@/components/operations/data-workspace';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_TONES: Record<string, 'success' | 'neutral' | 'warning' | 'danger' | 'info'> = {
  active: 'success',
  draft: 'neutral',
  pending_signature: 'warning',
  expired: 'danger',
  terminated: 'danger',
};

export default async function ManagementAgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string; q?: string }>;
}) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();

  let query = (supabase as any)
    .from('management_agreements')
    .select('id, name, status, start_date, end_date, auto_renew, signed_at, owner_id, owners(id, full_name), associations(id, name)')
    .is('archived_at', null)
    .order('start_date', { ascending: false })
    .limit(500);
  if (sp.owner) query = query.eq('owner_id', sp.owner);
  const { data } = await query;

  let rows = (data ?? []) as any[];
  if (q) {
    rows = rows.filter((r) =>
      [r.name, r.owners?.full_name, r.associations?.name].some((v) => v?.toLowerCase().includes(q)),
    );
  }
  const active = rows.filter((r) => r.status === 'active').length;
  const expiringSoon = rows.filter((r) => r.end_date && r.end_date <= new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) && r.status === 'active').length;

  return (
    <DataWorkspace
      title="Management Agreements"
      description="Agreements between the management company and owners/associations — terms, fees, and signature status."
      actions={
        <Link href={`/owners/management-agreements/new${sp.owner ? `?owner=${sp.owner}` : ''}`}>
          <Button>New agreement</Button>
        </Link>
      }
    >
      <div className="space-y-4">
        <MetricStrip
          metrics={[
            { label: 'Agreements', value: rows.length },
            { label: 'Active', value: active },
            { label: 'Expiring within 90 days', value: expiringSoon },
            { label: 'Signed', value: rows.filter((r) => r.signed_at).length },
          ]}
        />
        <Table>
          <THead>
            <TR>
              <TH>Agreement</TH>
              <TH>Owner</TH>
              <TH>Association</TH>
              <TH>Term</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <TR>
                <TD colSpan={5} className="py-10 text-center text-gray-500">
                  No management agreements yet. Create the first one with &quot;New agreement&quot;.
                </TD>
              </TR>
            ) : (
              rows.map((r) => (
                <TR key={r.id} className="hover:bg-gray-50">
                  <TD className="font-medium text-gray-900">{r.name ?? 'Management agreement'}</TD>
                  <TD>
                    {r.owners?.id
                      ? <Link href={`/owners/${r.owners.id}`} className="text-gray-900 hover:underline">{r.owners.full_name}</Link>
                      : '—'}
                  </TD>
                  <TD className="text-gray-600">{r.associations?.name ?? '—'}</TD>
                  <TD className="tabular-nums text-gray-600">
                    {r.start_date ? date(r.start_date) : '—'} — {r.end_date ? date(r.end_date) : 'ongoing'}
                    {r.auto_renew && <span className="ml-2 text-xs text-gray-400">auto-renews</span>}
                  </TD>
                  <TD>
                    <StatusChip tone={STATUS_TONES[r.status] ?? 'neutral'}>{String(r.status ?? '—').replace(/_/g, ' ')}</StatusChip>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
