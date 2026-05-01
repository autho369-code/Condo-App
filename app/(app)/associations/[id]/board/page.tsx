import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';

export const dynamic = 'force-dynamic';

export default async function BoardTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const { data: assoc, error: aErr } = await supabase
    .from('associations')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();
  if (aErr || !assoc) notFound();

  const { data: members } = await supabase
    .from('board_members')
    .select('id, full_name, role, term_start, term_end, signature_on_file, phone, email, active')
    .eq('association_id', id)
    .order('active', { ascending: false })
    .order('role');

  const current = (members ?? []).filter((m: any) => m.active);
  const past = (members ?? []).filter((m: any) => !m.active);

  const { data: settings } = await supabase
    .from('board_approval_settings')
    .select('signatures_required, default_board_member_ids, default_voting_scheme, sends_bills_to_board, bills_threshold')
    .eq('association_id', id)
    .maybeSingle();

  const sigsRequired = settings?.signatures_required ?? true;
  const defaultIds = settings?.default_board_member_ids ?? [];
  const defaultMembersLabel = defaultIds.length === 0 ? 'All' : `${defaultIds.length} selected`;
  const votingScheme = humanVotingScheme(settings?.default_voting_scheme ?? 'majority_approval_required');
  const sendsBills = humanSendsBills(settings?.sends_bills_to_board ?? 'never', settings?.bills_threshold);

  const rail = null;

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="board" />
          <WorkspaceHeader title="Board of Directors" subtitle={assoc.name} />
        </>
      }
      rail={rail}
    >
      <Section title="Board Members">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Name</th>
              <th className="px-4 py-2 text-left font-semibold">Role</th>
              <th className="px-4 py-2 text-left font-semibold">Start Date</th>
              <th className="px-4 py-2 text-left font-semibold">End Date</th>
              <th className="px-4 py-2 text-left font-semibold">Signature?</th>
              <th className="px-4 py-2 text-left font-semibold">Phone</th>
              <th className="px-4 py-2 text-left font-semibold">Email</th>
            </tr>
          </thead>
          <tbody>
            {current.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No active board members.</td></tr>
            ) : current.map((m: any) => (
              <tr key={m.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                <td className="px-4 py-3"><span className="text-blue-700">{m.full_name}</span></td>
                <td className="px-4 py-3 text-gray-700">{humanRole(m.role)}</td>
                <td className="px-4 py-3 text-gray-700">{m.term_start ? formatDate(m.term_start) : <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-700">{m.term_end ? formatDate(m.term_end) : <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-700">{m.signature_on_file ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-gray-700">{m.phone || <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-700">{m.email ? <a href={`mailto:${m.email}`} className="text-blue-700 hover:underline">{m.email}</a> : <span className="text-gray-400">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section>
        <details className="px-5 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900 list-none flex items-center gap-1">
            <span className="text-gray-500 text-xs">▸</span>
            Past Board Members
            {past.length > 0 && <span className="font-normal text-gray-500">({past.length})</span>}
          </summary>
          <table className="mt-3 w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Name</th>
                <th className="px-4 py-2 text-left font-semibold">Role</th>
                <th className="px-4 py-2 text-left font-semibold">Start Date</th>
                <th className="px-4 py-2 text-left font-semibold">End Date</th>
              </tr>
            </thead>
            <tbody>
              {past.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No past board members.</td></tr>
              ) : past.map((m: any) => (
                <tr key={m.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-4 py-3 text-gray-700">{m.full_name}</td>
                  <td className="px-4 py-3 text-gray-700">{humanRole(m.role)}</td>
                  <td className="px-4 py-3 text-gray-700">{m.term_start ? formatDate(m.term_start) : '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{m.term_end ? formatDate(m.term_end) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Section>

      <Section
        title="Board Approvals"
        actions={<Link href={`/associations/${id}/board/edit-approvals`} className="text-sm text-blue-700 hover:underline">Edit</Link>}
        padded
      >
        <dl className="grid grid-cols-[200px_1fr] gap-y-2.5 text-sm">
          <dt className="text-gray-500">Signatures Required</dt>
          <dd className="text-gray-900">{sigsRequired ? 'Yes' : 'No'}</dd>

          <dt className="text-gray-500">Default Board Members</dt>
          <dd className="text-gray-900">{defaultMembersLabel}</dd>

          <dt className="text-gray-500">Voting Scheme</dt>
          <dd className="text-gray-900">{votingScheme}</dd>

          <dt className="text-gray-500">Sends Bills To Board</dt>
          <dd className="text-gray-900">{sendsBills}</dd>
        </dl>
      </Section>
    </Workspace>
  );
}

function humanRole(role: string | null): string {
  if (!role) return '—';
  return role.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
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

function humanSendsBills(value: string, threshold: number | null | undefined): string {
  switch (value) {
    case 'always':         return 'Always';
    case 'over_threshold': return threshold != null ? `Over $${Number(threshold).toFixed(2)}` : 'Over threshold';
    case 'never':
    default:               return 'Never';
  }
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}
