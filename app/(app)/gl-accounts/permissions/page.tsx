import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { requirePortfolioAdmin } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Alert, EmptyState } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { setGlRolePermission } from './actions';

export const dynamic = 'force-dynamic';

export default async function GlPermissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ role_id?: string; error?: string; saved?: string }>;
}) {
  const me = await requirePortfolioAdmin();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const [{ data: roles }, { data: accounts }, { data: permissionRows }] = await Promise.all([
    db.from('user_roles').select('id, name, description, is_system').eq('portfolio_id', me.portfolio?.id).order('name'),
    db.from('gl_accounts').select('id, number, name, account_type, active').eq('portfolio_id', me.portfolio?.id).order('number'),
    db.from('gl_account_role_permissions').select('gl_account_id, role_id, permission'),
  ]);
  const selectedRoleId = (roles ?? []).some((role: any) => role.id === sp.role_id) ? sp.role_id : roles?.[0]?.id;
  const selectedRole = (roles ?? []).find((role: any) => role.id === selectedRoleId);
  const permissions = new Map((permissionRows ?? []).filter((row: any) => row.role_id === selectedRoleId).map((row: any) => [row.gl_account_id, row.permission]));

  return <DataWorkspace title="GL Role Permissions" description="Control which chart-of-account lines each custom staff role can report on or use in postings." actions={<Link href="/gl-accounts"><Button variant="secondary">Back to GL accounts</Button></Link>}>
    <div className="space-y-5">
      {sp.error && <Alert title="Could not save permission">{sp.error}</Alert>}
      {sp.saved && <Alert tone="success">GL permission saved and audit logged.</Alert>}
      <Alert tone="info" title="Permission semantics.">Read allows reporting visibility. Full also permits account selection in controlled posting workflows. None is an explicit denial. Company administrators, finance staff, and full-access staff retain their privileged access.</Alert>
      {(roles ?? []).length ? <>
        <form action="/gl-accounts/permissions" className="flex max-w-xl flex-col gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium text-gray-700">Staff role<Select name="role_id" defaultValue={selectedRoleId} className="mt-1.5">{(roles ?? []).map((role: any) => <option key={role.id} value={role.id}>{role.name}</option>)}</Select></label>
          <Button type="submit" variant="secondary">View role</Button>
        </form>
        <div className="rounded-2xl border border-gray-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"><div className="mb-4"><h2 className="font-semibold text-gray-950">{selectedRole?.name}</h2><p className="text-sm text-gray-500">{selectedRole?.description ?? 'Custom portfolio role'}</p></div>
          <Table><THead><TR><TH>Account</TH><TH>Type</TH><TH>Status</TH><TH className="w-[300px]">Permission</TH></TR></THead><tbody>{(accounts ?? []).map((account: any) => <TR key={account.id}><TD><span className="font-mono text-gray-500">{account.number}</span><span className="ml-3 font-medium text-gray-900">{account.name}</span></TD><TD className="capitalize">{account.account_type.replace(/_/g, ' ')}</TD><TD>{account.active ? 'Active' : 'Inactive'}</TD><TD><form action={setGlRolePermission} className="flex gap-2"><input type="hidden" name="gl_account_id" value={account.id} /><input type="hidden" name="role_id" value={selectedRoleId} /><Select name="permission" defaultValue={String(permissions.get(account.id) ?? 'none')}><option value="none">None</option><option value="read">Read</option><option value="full">Full</option></Select><Button type="submit" variant="secondary">Save</Button></form></TD></TR>)}</tbody></Table>
        </div>
      </> : <div className="rounded-2xl border border-gray-200/70 bg-white"><EmptyState icon={ShieldCheck} title="Create a custom staff role first" description="GL permissions attach to portfolio roles, not individual people." /></div>}
    </div>
  </DataWorkspace>;
}
