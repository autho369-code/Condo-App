import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { StatusChip } from '@/components/operations/status-chip';
import { Button } from '@/components/ui/button';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ManagementAgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  await requireStaff();
  const { created } = await searchParams;
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('management_agreements')
    .select('id, name, start_date, end_date, status, created_at, associations(name), owners(full_name)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <DataWorkspace
      title="Management Agreements"
      description="Track owner and association agreement drafts, active agreements, renewal status, and signature timing."
      actions={<Link href="/owners/management-agreements/new"><Button>New Management Agreement</Button></Link>}
      rail={<p className="text-sm leading-6 text-ink-600">Draft records are stored here before signature delivery or document upload.</p>}
    >
      <div className="space-y-5">
        {created && (
          <div className="rounded border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-900">
            Management agreement draft saved.
          </div>
        )}

        {rows && rows.length > 0 ? (
          <Table>
            <THead>
              <TR><TH>Agreement</TH><TH>Association</TH><TH>Owner</TH><TH>Start</TH><TH>End</TH><TH>Status</TH></TR>
            </THead>
            <tbody>
              {rows.map((row: any) => (
                <TR key={row.id}>
                  <TD className="font-medium text-ink-900">{row.name}</TD>
                  <TD>{row.associations?.name ?? '-'}</TD>
                  <TD>{row.owners?.full_name ?? '-'}</TD>
                  <TD>{date(row.start_date)}</TD>
                  <TD>{date(row.end_date)}</TD>
                  <TD><StatusChip tone={row.status === 'active' ? 'success' : row.status === 'draft' ? 'info' : 'neutral'}>{row.status}</StatusChip></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="rounded border border-dashed border-ink-200 bg-white px-6 py-10 text-center text-sm text-ink-500">No management agreements found.</p>
        )}
      </div>
    </DataWorkspace>
  );
}
