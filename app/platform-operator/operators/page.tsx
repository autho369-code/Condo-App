import { createClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { Alert, PageHeader, Badge, EmptyState } from '@/components/ui/shell';
import { DataTable } from '@/components/ui/table';
import { ShieldCheck } from 'lucide-react';
import { date } from '@/lib/utils';
import { resetOperatorMfa } from './actions';
import { MfaResetButton } from '@/components/auth/mfa-reset-button';

export const dynamic = 'force-dynamic';

export default async function PlatformOperatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ mfa_reset?: string; error?: string }>;
}) {
  const me = await requirePlatformOperator();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('platform_operators')
    .select('id, auth_user_id, email, full_name, role, active, created_at, mfa_enrolled_at')
    .order('created_at');
  const actor = (rows ?? []).find((operator: any) => operator.auth_user_id === me.auth_user_id);
  const canResetMfa = actor?.active === true && actor.role === 'admin';
  const activeAdminCount = (rows ?? []).filter((operator: any) => operator.active && operator.role === 'admin').length;

  return (
    <div className="space-y-5">
      {sp.error && <Alert title="Could not reset MFA">{sp.error}</Alert>}
      {sp.mfa_reset === '1' && (
        <Alert tone="success" title="Authenticator reset">
          The operator must set up a new authenticator at the next sign-in.
        </Alert>
      )}
      {activeAdminCount < 2 && (
        <Alert tone="warning" title="Recovery coverage needs a second administrator">
          Keep at least two active platform administrators so one can reset the other’s MFA. Until then, the audited break-glass runbook is required for lost-authenticator recovery.
        </Alert>
      )}
      <PageHeader
        title="Platform operators"
        description="People with platform-level access to Portier369. Operators manage companies, billing, and subscriptions — they cannot modify association accounting or act as board members."
      />
      <DataTable
        rows={rows ?? []}
        rowKey={(o: any) => o.id}
        columns={[
          {
            key: 'email',
            header: 'Operator',
            render: (o: any) => (
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-900">{o.full_name ?? o.email}</div>
                {o.full_name && <div className="truncate text-[12px] text-gray-500">{o.email}</div>}
              </div>
            ),
          },
          { key: 'role', header: 'Role', render: (o: any) => <span className="capitalize text-gray-700">{(o.role ?? '—').replace(/_/g, ' ')}</span> },
          { key: 'active', header: 'Status', render: (o: any) => <Badge tone={o.active ? 'complete' : 'inactive'}>{o.active ? 'Active' : 'Disabled'}</Badge> },
          { key: 'mfa', header: 'MFA', render: (o: any) => <Badge tone={o.mfa_enrolled_at ? 'complete' : 'pending'}>{o.mfa_enrolled_at ? 'Enrolled' : 'Setup needed'}</Badge> },
          { key: 'created_at', header: 'Added', className: 'text-gray-500', render: (o: any) => date(o.created_at) },
          {
            key: 'actions',
            header: '',
            render: (o: any) => canResetMfa && o.auth_user_id !== me.auth_user_id ? (
              <MfaResetButton action={resetOperatorMfa} userId={o.auth_user_id} variant="ghost" />
            ) : <span className="text-xs text-gray-400">{o.auth_user_id === me.auth_user_id ? 'Current account' : 'Read only'}</span>,
          },
        ]}
        empty={<EmptyState icon={ShieldCheck} title="No platform operators" description="Operators are managed directly in the platform_operators table." />}
      />
    </div>
  );
}
