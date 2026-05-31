import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar } from '@/components/operations/filter-bar';
import { MetricStrip } from '@/components/operations/metric-strip';
import { StatusChip } from '@/components/operations/status-chip';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { sendACHInvite } from '@/lib/people/owner-workflow-actions';

export const dynamic = 'force-dynamic';

export default async function OwnerAchPage({ searchParams }: { searchParams: Promise<{ q?: string; owner?: string; ok?: string; error?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const q = (sp.q ?? '').trim().toLowerCase();
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data: owners }, { data: achStatuses }] = await Promise.all([
    db.from('owners').select('id, full_name, email, archived_at').is('archived_at', null).order('full_name'),
    db.from('owner_ach_status').select('id, owner_id, status, invited_at, completed_at, verified_at, last_error'),
  ]);

  const achByOwner = new Map();
  for (const a of (achStatuses ?? [])) { achByOwner.set(a.owner_id, a); }

  let rows = (owners ?? []).map((o: any) => ({ owner: o, ach: achByOwner.get(o.id) || null }));
  if (sp.owner) rows = rows.filter((r: any) => r.owner.id === sp.owner);
  if (q) rows = rows.filter((r: any) => [r.owner.full_name, r.owner.email].some((v: string) => v?.toLowerCase().includes(q)));

  const verified = rows.filter((r: any) => r.ach?.status === 'verified').length;
  const inProgress = rows.filter((r: any) => r.ach && !['verified', 'not_started'].includes(r.ach.status)).length;

  const stripeConnected = !!process.env.STRIPE_SECRET_KEY;

  return (
    <DataWorkspace
      title="ACH Setup"
      description="Track ACH payment setup per owner. Bank information is never collected here — payment setup happens through Stripe's secure flow."
      actions={<Link href="/owners" className="text-sm font-medium text-blue-700 hover:underline">Back to owners</Link>}
      rail={
        <div className="space-y-3 text-sm">
          {!stripeConnected && (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Payment processor not connected. Configure Stripe to enable ACH payment collection.
            </div>
          )}
          {sp.ok && <div className="rounded border border-green-200 bg-green-50 p-3 text-xs text-green-800">{sp.ok}</div>}
          {sp.error && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-800">{sp.error}</div>}
        </div>
      }
    >
      <div className="space-y-4">
        <MetricStrip metrics={[
          { label: 'Owners', value: rows.length },
          { label: 'Verified', value: verified },
          { label: 'In Progress', value: inProgress },
          { label: 'Not Started', value: rows.length - verified - inProgress },
        ]} />
        <FilterBar action="/owners/ach" searchDefault={sp.q ?? ''} searchPlaceholder="Search owner or email" />
        <Table>
          <THead><TR><TH>Owner</TH><TH>Status</TH><TH>Invited</TH><TH>Completed</TH><TH>Action</TH></TR></THead>
          <tbody>
            {rows.map(({ owner, ach }: any) => (
              <TR key={owner.id}>
                <TD>
                  <Link href={`/owners/${owner.id}`} className="font-medium text-blue-700 hover:underline">{owner.full_name}</Link>
                  <div className="mt-1 text-xs text-gray-500">{owner.email}</div>
                </TD>
                <TD>
                  <StatusChip tone={ach?.status === 'verified' ? 'success' : ach?.status === 'failed' ? 'warning' : ach ? 'info' : 'neutral'}>
                    {ach?.status?.replace(/_/g, ' ') ?? 'Not started'}
                  </StatusChip>
                  {ach?.last_error && <div className="mt-1 text-xs text-red-500">{ach.last_error}</div>}
                </TD>
                <TD className="text-sm text-gray-500">{ach?.invited_at ? new Date(ach.invited_at).toLocaleDateString() : '—'}</TD>
                <TD className="text-sm text-gray-500">{ach?.completed_at ? new Date(ach.completed_at).toLocaleDateString() : '—'}</TD>
                <TD>
                  {stripeConnected ? (
                    <form action={sendACHInvite}>
                      <input type="hidden" name="owner_id" value={owner.id} />
                      <Button type="submit" size="sm" variant="secondary" disabled={ach?.status === 'verified'}>
                        {ach ? 'Resend invite' : 'Send invite'}
                      </Button>
                    </form>
                  ) : (
                    <span className="text-xs text-gray-400">Processor not connected</span>
                  )}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
