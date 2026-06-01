import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function NewApprovalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations').select('id, name, portfolio_id').eq('id', id).maybeSingle();
  if (aErr || !assoc) notFound();

  const { data: members } = await (supabase as any)
    .from('board_members')
    .select('id, full_name, role')
    .eq('association_id', id)
    .eq('active', true)
    .order('role');

  const { data: settings } = await (supabase as any)
    .from('board_approval_settings')
    .select('default_board_member_ids, default_voting_scheme, signatures_required')
    .eq('association_id', id)
    .maybeSingle();

  const defaultIds = settings?.default_board_member_ids ?? [];
  const initiallyChecked = new Set<string>(
    defaultIds.length === 0 ? (members ?? []).map((m: any) => m.id) : defaultIds
  );

  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 14);
  const defaultDueDateValue = defaultDueDate.toISOString().slice(0, 10);

  async function createApproval(formData: FormData) {
    'use server';
    const supabase = await createClient();

    const name = String(formData.get('name') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const dueDate = String(formData.get('due_date') ?? '').trim();
    const amountRaw = String(formData.get('amount') ?? '').trim();
    const votingScheme = String(formData.get('voting_scheme') ?? 'majority_approval_required');
    const boardMemberIds = formData.getAll('board_member_ids').map(String);

    if (!name || !description || !dueDate) {
      throw new Error('Name, Description, and Due Date are required.');
    }

    let requiredVotes: number;
    switch (votingScheme) {
      case 'unanimous_approval_required': requiredVotes = boardMemberIds.length; break;
      case 'any_one_approver':            requiredVotes = 1; break;
      case 'majority_approval_required':
      default:                            requiredVotes = Math.floor(boardMemberIds.length / 2) + 1;
    }

    const { error } = await (supabase as any).from('approval_requests').insert({
      portfolio_id: assoc!.portfolio_id,
      association_id: id,
      request_type: 'expense',
      title: name,
      description,
      amount: amountRaw ? Number(amountRaw) : null,
      due_date: dueDate,
      voting_scheme: votingScheme,
      board_member_ids: boardMemberIds,
      signatures_required: settings?.signatures_required ?? true,
      required_votes: requiredVotes,
      status: 'pending',
      requested_at: new Date().toISOString(),
    });

    if (error) throw new Error(`Could not create approval: ${error.message}`);
    redirect(`/associations/${id}/approvals`);
  }

  const rail = null;

  return (
    <Workspace
      header={
        <>
          <AssociationTabs associationId={id} active="approvals" />
          <WorkspaceHeader title="New Approval" subtitle={assoc.name} />
        </>
      }
      rail={rail}
    >
      <form action={createApproval as any} className="max-w-3xl space-y-5">
        <Section title="Details" padded>
          <FormRow label="Name" required>
            <input type="text" name="name" required className="w-full max-w-md rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </FormRow>

          <FormRow label="Amount">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">$</span>
              <input type="number" step="0.01" min="0" name="amount" className="w-44 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </FormRow>

          <FormRow label="Description" required>
            <textarea name="description" required rows={4} className="w-full max-w-lg resize-y rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </FormRow>

          <FormRow label="Due Date" required>
            <input type="date" name="due_date" required defaultValue={defaultDueDateValue} className="w-44 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </FormRow>

          <FormRow label="Board Members" required>
            <div className="flex flex-col gap-1.5">
              {(members ?? []).length === 0 ? (
                <div className="text-sm italic text-slate-400">
                  No active board members. Add some on the Board of Directors tab.
                </div>
              ) : (members ?? []).map((m: any) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="board_member_ids"
                    value={m.id}
                    defaultChecked={initiallyChecked.has(m.id)}
                  />
                  {m.full_name} <span className="text-slate-400">({humanRole(m.role)})</span>
                </label>
              ))}
            </div>
          </FormRow>

          <FormRow label="Voting Scheme">
            <select name="voting_scheme" defaultValue={settings?.default_voting_scheme ?? 'majority_approval_required'} className="w-72 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
              <option value="majority_approval_required">Majority Approval Required</option>
              <option value="unanimous_approval_required">Unanimous Approval Required</option>
              <option value="any_one_approver">Any One Approver</option>
              <option value="percentage_required">Percentage Required</option>
            </select>
          </FormRow>

          <div className="my-4 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-gray-700">
            <span className="mr-1 text-blue-600">â“˜</span>
            Clicking &quot;Send for Approval&quot; will email this new approval to your selected board members.
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm">Send for Approval</Button>
            <Link href={`/associations/${id}/approvals`}>
              <Button type="button" size="sm" variant="secondary">Cancel</Button>
            </Link>
          </div>
        </Section>

        <Section title="Attachments" padded>
          <div className="rounded border-2 border-dashed border-gray-300 py-8 text-center text-sm text-slate-400">
            Drag Files Here&nbsp;&nbsp;or&nbsp;&nbsp;
            <Button type="button" size="sm" variant="secondary" disabled>Choose Files to Add</Button>
            <div className="mt-1 text-xs text-gray-400">Attachment upload pending Storage bucket wiring</div>
          </div>
        </Section>
      </form>
    </Workspace>
  );
}

function FormRow({
  label, required, children,
}: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-3 grid grid-cols-[140px_1fr] items-start gap-x-3 gap-y-1">
      <label className="pt-1.5 text-sm text-slate-400">
        {label}{required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      <div>{children}</div>
    </div>
  );
}

function humanRole(role: string | null): string {
  if (!role) return '';
  return role.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}
