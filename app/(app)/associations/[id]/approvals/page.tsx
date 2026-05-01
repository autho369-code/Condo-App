import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function ApprovalsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const { data: assoc, error: aErr } = await supabase
    .from('associations').select('id, name').eq('id', id).maybeSingle();
  if (aErr || !assoc) notFound();

  const { data: rows } = await supabase
    .from('approval_requests')
    .select('id, title, status, amount, due_date, voting_scheme, requested_at, votes_for, votes_against, votes_abstain, required_votes')
    .eq('association_id', id)
    .is('archived_at', null)
    .order('requested_at', { ascending: false });

  const rail = null;

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="approvals" />
          <WorkspaceHeader
            title="Approvals"
            subtitle={assoc.name}
            actions={
              <Link href={`/associations/${id}/approvals/new`}>
                <Button size="sm">+ New Approval</Button>
              </Link>
            }
          />
        </>
      }
      rail={rail}
    >
      <Section>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Title</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-left font-semibold">Amount</th>
              <th className="px-4 py-2 text-left font-semibold">Due Date</th>
              <th className="px-4 py-2 text-left font-semibold">Voting Scheme</th>
              <th className="px-4 py-2 text-left font-semibold">Votes</th>
              <th className="px-4 py-2 text-left font-semibold">Requested</th>
            </tr>
          </thead>
          <tbody>
            {(!rows || rows.length === 0) ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No approval requests.</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/associations/${id}/approvals/${r.id}`} className="text-blue-700 hover:underline">{r.title}</Link>
                </td>
                <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                <td className="px-4 py-3 tabular-nums text-gray-700">
                  {r.amount != null ? `$${Number(r.amount).toFixed(2)}` : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-700">{r.due_date ? formatDate(r.due_date) : <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-700">{humanVotingScheme(r.voting_scheme)}</td>
                <td className="px-4 py-3 tabular-nums text-gray-700">
                  {r.votes_for}/{r.required_votes ?? '—'}
                  {(r.votes_against > 0 || r.votes_abstain > 0) && (
                    <span className="ml-1 text-xs text-gray-500">
                      ({r.votes_against} no, {r.votes_abstain} abstain)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">{r.requested_at ? formatDate(r.requested_at) : <span className="text-gray-400">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </Workspace>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pending:   { cls: 'bg-amber-50 text-amber-800',  label: 'Pending' },
    approved:  { cls: 'bg-green-50 text-green-800',  label: 'Approved' },
    rejected:  { cls: 'bg-red-50 text-red-800',      label: 'Rejected' },
    cancelled: { cls: 'bg-gray-100 text-gray-700',   label: 'Cancelled' },
  };
  const s = map[status] ?? map.pending;
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function humanVotingScheme(scheme: string): string {
  switch (scheme) {
    case 'majority_approval_required':  return 'Majority Approval Required';
    case 'unanimous_approval_required': return 'Unanimous Approval Required';
    case 'any_one_approver':            return 'Any One Approver';
    case 'percentage_required':         return 'Percentage Required';
    default: return scheme;
  }
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}
