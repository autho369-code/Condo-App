import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AssociationTabs } from '@/components/associations/tabs';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Section, Workspace, WorkspaceHeader } from '@/components/workspace/shell';
import { requireStaff } from '@/lib/auth/me';
import { boardRoleLabel } from '@/lib/associations/board-members';
import { addBoardMember } from '@/lib/rpcs/board-members';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BoardTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ board_added?: string; board_error?: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();
  if (aErr || !assoc) notFound();

  const { data: members } = await (supabase as any)
    .from('board_members')
    .select('id, full_name, role, term_start, term_end, signature_on_file, phone, email, active')
    .eq('association_id', id)
    .order('active', { ascending: false })
    .order('role');

  const current = (members ?? []).filter((m: any) => m.active);
  const past = (members ?? []).filter((m: any) => !m.active);

  const { data: settings } = await (supabase as any)
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
      {sp.board_added && (
        <div className="mb-4 rounded-md border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-800">
          Board member added.
        </div>
      )}

      {sp.board_error && (
        <div className="mb-4 rounded-md border border-bordeaux-200 bg-bordeaux-50 px-4 py-3 text-sm text-bordeaux-700">
          {sp.board_error}
        </div>
      )}

      <Section
        title="Add Board Member"
        subtitle="Create board contacts for approvals, signatures, and association governance."
        padded
      >
        <form action={addBoardMember.bind(null, id)} className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-4">
            <Label htmlFor="full_name">Name</Label>
            <Input id="full_name" name="full_name" required placeholder="Full name" />
          </div>

          <div className="xl:col-span-3">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              name="role"
              defaultValue="director"
              className="h-10 w-full rounded-md border border-ink-200 bg-white px-3.5 text-sm text-ink-900 transition-colors hover:border-ink-300 focus:border-champagne-500 focus:outline-none focus:ring-2 focus:ring-champagne-200/60"
            >
              <option value="president">President</option>
              <option value="vice_president">Vice President</option>
              <option value="secretary">Secretary</option>
              <option value="treasurer">Treasurer</option>
              <option value="director">Director</option>
            </select>
          </div>

          <div className="xl:col-span-2">
            <Label htmlFor="term_start">Start Date</Label>
            <Input id="term_start" name="term_start" type="date" />
          </div>

          <div className="xl:col-span-2">
            <Label htmlFor="term_end">End Date</Label>
            <Input id="term_end" name="term_end" type="date" />
          </div>

          <label className="flex items-end gap-2 pb-2 text-sm text-ink-700 xl:col-span-1">
            <input name="signature_on_file" type="checkbox" className="mb-0.5 h-4 w-4 rounded border-ink-300" />
            Signature
          </label>

          <div className="xl:col-span-4">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" placeholder="(312) 555-0100" />
          </div>

          <div className="xl:col-span-5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="board.member@example.com" />
          </div>

          <div className="flex items-end xl:col-span-3">
            <Button type="submit" className="w-full xl:w-auto">Add board member</Button>
          </div>
        </form>
      </Section>

      <Section title="Board Members">
        <table className="w-full text-sm">
          <thead className="border-b border-ink-100 bg-cream-50 text-xs uppercase tracking-wide text-ink-600">
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
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-500">
                  No active board members.
                </td>
              </tr>
            ) : current.map((m: any) => (
              <tr key={m.id} className="border-b border-ink-100 last:border-b-0 hover:bg-cream-50">
                <td className="px-4 py-3"><span className="text-champagne-700">{m.full_name}</span></td>
                <td className="px-4 py-3 text-ink-700">{boardRoleLabel(m.role)}</td>
                <td className="px-4 py-3 text-ink-700">{m.term_start ? formatDate(m.term_start) : <span className="text-ink-400">-</span>}</td>
                <td className="px-4 py-3 text-ink-700">{m.term_end ? formatDate(m.term_end) : <span className="text-ink-400">-</span>}</td>
                <td className="px-4 py-3 text-ink-700">{m.signature_on_file ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3 text-ink-700">{m.phone || <span className="text-ink-400">-</span>}</td>
                <td className="px-4 py-3 text-ink-700">{m.email ? <a href={`mailto:${m.email}`} className="text-champagne-700 hover:underline">{m.email}</a> : <span className="text-ink-400">-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section>
        <details className="px-5 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-ink-900">
            <span className="text-xs text-ink-500">+</span>
            Past Board Members
            {past.length > 0 && <span className="font-normal text-ink-500">({past.length})</span>}
          </summary>
          <table className="mt-3 w-full text-sm">
            <thead className="border-b border-ink-100 bg-cream-50 text-xs uppercase tracking-wide text-ink-600">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Name</th>
                <th className="px-4 py-2 text-left font-semibold">Role</th>
                <th className="px-4 py-2 text-left font-semibold">Start Date</th>
                <th className="px-4 py-2 text-left font-semibold">End Date</th>
              </tr>
            </thead>
            <tbody>
              {past.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-ink-500">
                    No past board members.
                  </td>
                </tr>
              ) : past.map((m: any) => (
                <tr key={m.id} className="border-b border-ink-100 last:border-b-0">
                  <td className="px-4 py-3 text-ink-700">{m.full_name}</td>
                  <td className="px-4 py-3 text-ink-700">{boardRoleLabel(m.role)}</td>
                  <td className="px-4 py-3 text-ink-700">{m.term_start ? formatDate(m.term_start) : '-'}</td>
                  <td className="px-4 py-3 text-ink-700">{m.term_end ? formatDate(m.term_end) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Section>

      <Section
        title="Board Approvals"
        actions={<Link href={`/associations/${id}/board/edit-approvals`} className="text-sm text-champagne-700 hover:underline">Edit</Link>}
        padded
      >
        <dl className="grid grid-cols-[200px_1fr] gap-y-2.5 text-sm">
          <dt className="text-ink-500">Signatures Required</dt>
          <dd className="text-ink-900">{sigsRequired ? 'Yes' : 'No'}</dd>

          <dt className="text-ink-500">Default Board Members</dt>
          <dd className="text-ink-900">{defaultMembersLabel}</dd>

          <dt className="text-ink-500">Voting Scheme</dt>
          <dd className="text-ink-900">{votingScheme}</dd>

          <dt className="text-ink-500">Sends Bills To Board</dt>
          <dd className="text-ink-900">{sendsBills}</dd>
        </dl>
      </Section>
    </Workspace>
  );
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
