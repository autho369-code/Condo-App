import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { Workspace, WorkspaceHeader, Section } from '@/components/workspace/shell';
import { AssociationTabs } from '@/components/associations/tabs';
import { resolveAssociation } from '@/lib/associations/resolve';
import { signSignaturePaths } from '@/lib/board/signature';
import { ApprovalRulesForm } from '@/components/associations/approval-rules-form';
import { BoardReportsSection } from '@/components/associations/board-reports-section';
import { Alert } from '@/components/ui/shell';
import { saveBoardApprovalSettings } from '@/lib/rpcs/purchase-orders';

export const dynamic = 'force-dynamic';

export default async function BoardTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; report_error?: string; report_saved?: string }>;
}) {
  const me = await requireStaff();
  const { id: assocParam } = await params;
  const sp = await searchParams;
  const association = await resolveAssociation(assocParam);
  if (!association) notFound();
  const id = association.id;
  const supabase = await createClient();

  const { data: assoc, error: aErr } = await (supabase as any)
    .from('associations')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();
  if (aErr || !assoc) notFound();

  const { data: members } = await (supabase as any)
    .from('board_members')
    .select('id, full_name, role, term_start, term_end, signature_on_file, signature_url, phone, email, active')
    .eq('association_id', id)
    .order('active', { ascending: false })
    .order('role');

  const current = (members ?? []).filter((m: any) => m.active);
  const past = (members ?? []).filter((m: any) => !m.active);

  // Signed thumbnails for captured signatures (private bucket).
  const sigUrlByRef = await signSignaturePaths(current.map((m: any) => m.signature_url));

  const { data: settings } = await (supabase as any)
    .from('board_approval_settings')
    .select('signatures_required, default_board_member_ids, default_voting_scheme, default_percentage_required, sends_bills_to_board, bills_threshold, sends_pos_to_board, pos_threshold')
    .eq('association_id', id)
    .maybeSingle();

  const defaultIds = settings?.default_board_member_ids ?? [];
  const defaultMembersLabel = defaultIds.length === 0 ? 'All' : `${defaultIds.length} selected`;

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
          <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
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
                <td className="px-4 py-3.5"><span className="font-medium text-gray-900">{m.full_name}</span></td>
                <td className="px-4 py-3 text-gray-700">{humanRole(m.role)}</td>
                <td className="px-4 py-3 text-gray-700">{m.term_start ? formatDate(m.term_start) : <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-700">{m.term_end ? formatDate(m.term_end) : <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-700">
                  {m.signature_url && sigUrlByRef.get(m.signature_url.trim()) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sigUrlByRef.get(m.signature_url.trim())}
                      alt={`${m.full_name} signature`}
                      className="h-8 w-auto max-w-[120px] rounded border border-gray-100 bg-white object-contain"
                    />
                  ) : (
                    m.signature_on_file ? 'Yes' : 'No'
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">{m.phone || <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-700">{m.email ? <a href={`mailto:${m.email}`} className="text-blue-700 hover:underline">{m.email}</a> : <span className="text-gray-400">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section>
        <details className="px-5 py-3.5">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900 list-none flex items-center gap-1">
            <span className="text-gray-500 text-xs">▸</span>
            Past Board Members
            {past.length > 0 && <span className="font-normal text-gray-500">({past.length})</span>}
          </summary>
          <table className="mt-3 w-full text-sm">
            <thead className="border-b border-line bg-gray-50/70 text-[12.5px] text-gray-500">
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

      <BoardReportsSection associationId={id} associationRef={association.slug ?? id} error={sp.report_error} saved={sp.report_saved} />

      <Section title="Approval rules" subtitle={`Default approvers: ${defaultMembersLabel}. Bills and purchase orders routed to the board wait for a vote before they can be paid or issued.`} padded>
        {sp.error && <Alert tone="danger" title="Could not save approval rules:" className="mb-4">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success" className="mb-4">Approval rules saved.</Alert>}
        <ApprovalRulesForm
          associationId={id}
          settings={settings}
          action={saveBoardApprovalSettings}
          canEdit={me.is_full_access_staff || me.is_platform_operator}
        />
      </Section>
    </Workspace>
  );
}

function humanRole(role: string | null): string {
  if (!role) return '—';
  return role.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}
