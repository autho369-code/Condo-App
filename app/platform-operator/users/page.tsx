import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TD, TH, THead, TR } from '@/components/ui/table';
import { Alert } from '@/components/ui/shell';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requirePlatformOperator } from '@/lib/auth/me';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const USERS = '/platform-operator/users';

function fail(message: string): never {
  redirect(`${USERS}?error=${encodeURIComponent(message)}`);
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

function roleLabel(hoaRole: string | null | undefined): string {
  if (!hoaRole) return 'Unknown';
  return hoaRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function userStatusBadge(user: any) {
  if (user.disabled_at) return <Badge className="bg-red-50 text-red-700 ring-red-200">Disabled</Badge>;
  if (!user.last_login_at) return <Badge className="bg-amber-50 text-amber-700 ring-amber-200">Never logged in</Badge>;
  return <Badge className="bg-green-50 text-green-700 ring-green-200">Active</Badge>;
}

async function audit(
  svc: any,
  me: { auth_user_id: string | null; email: string | null },
  action: string,
  userId: string,
  changes: Record<string, unknown> = {},
) {
  await svc.from('audit_logs').insert({
    entity_type: 'user',
    entity_id: userId,
    action,
    actor_id: me.auth_user_id,
    actor_email: me.email,
    changes,
  });
}

async function toggleUserDisable(formData: FormData) {
  'use server';
  const me = await requirePlatformOperator();
  const svc = createServiceClient() as any;
  const userId = formData.get('user_id') as string;
  const action = formData.get('action') as string;

  const disabledAt = action === 'disable' ? new Date().toISOString() : null;
  const { error } = await svc.from('profiles').update({ disabled_at: disabledAt }).eq('id', userId);
  if (error) fail(`Could not ${action === 'disable' ? 'disable' : 'enable'} the user: ${error.message}`);

  await audit(svc, me, action === 'disable' ? 'user_disabled' : 'user_enabled', userId, { disabled_at: disabledAt });
  revalidatePath(USERS);
  redirect(`${USERS}?${action === 'disable' ? 'disabled' : 'enabled'}=1`);
}

async function changeUserRole(formData: FormData) {
  'use server';
  const me = await requirePlatformOperator();
  const svc = createServiceClient() as any;
  const userId = formData.get('user_id') as string;
  const newRole = formData.get('hoa_role') as string;

  const { error } = await svc.from('profiles').update({ hoa_role: newRole }).eq('id', userId);
  if (error) fail(`Could not change the user's role: ${error.message}`);

  await audit(svc, me, 'user_role_changed', userId, { hoa_role: newRole });
  revalidatePath(USERS);
  redirect(`${USERS}?role_changed=1`);
}

// Soft-delete per platform soft-delete policy: disable the account rather than
// destroying the profile row (preserves history and FK integrity).
async function deleteUser(formData: FormData) {
  'use server';
  const me = await requirePlatformOperator();
  const svc = createServiceClient() as any;
  const userId = formData.get('user_id') as string;

  const { error } = await svc.from('profiles').update({ disabled_at: new Date().toISOString() }).eq('id', userId);
  if (error) fail(`Could not delete the user: ${error.message}`);

  await audit(svc, me, 'user_soft_deleted', userId, {});
  revalidatePath(USERS);
  redirect(`${USERS}?deleted=1`);
}

const ROLE_OPTIONS = [
  { value: 'company_admin', label: 'Company Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'assistant_manager', label: 'Assistant Manager' },
  { value: 'accounting_staff', label: 'Accounting Staff' },
  { value: 'board_member', label: 'Board Member' },
  { value: 'owner', label: 'Owner' },
  { value: 'vendor', label: 'Vendor' },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; company?: string; status?: string; role_changed?: string; deleted?: string; disabled?: string; enabled?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const me = await requirePlatformOperator();
  const supabase = await createClient();
  const db = supabase as any;

  // Build query with filters
  let query = db.from('profiles')
    .select('id, email, full_name, display_name, hoa_role, portfolio_id, last_login_at, mfa_enrolled_at, disabled_at')
    .order('email')
    .limit(200);

  if (sp.role) query = query.eq('hoa_role', sp.role);
  if (sp.company) query = query.eq('portfolio_id', sp.company);
  if (sp.status === 'disabled') query = query.not('disabled_at', 'is', null);
  else if (sp.status === 'active') query = query.is('disabled_at', null);

  const [{ data: users }, { data: portfolios }] = await Promise.all([
    query,
    db.from('portfolios').select('id, company_name').order('company_name'),
  ]);

  const portfolioMap = new Map<string, string>();
  (portfolios ?? []).forEach((p: any) => portfolioMap.set(p.id, p.company_name));

  return (
    <div className="space-y-7">
      {sp.error && <Alert title="Action failed">{sp.error}</Alert>}
      {(sp.disabled === '1' || sp.enabled === '1') && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="font-semibold text-green-900">{sp.disabled === '1' ? 'User disabled' : 'User enabled'}</h3>
          <p className="text-sm text-green-700 mt-1">
            {sp.disabled === '1'
              ? 'The user has been disabled and can no longer be used.'
              : 'The user has been re-enabled.'}
          </p>
        </div>
      )}
      {sp.role_changed === '1' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <h3 className="font-semibold text-green-900">Role updated</h3>
          <p className="text-sm text-green-700 mt-1">The user&apos;s role has been changed.</p>
        </div>
      )}
      {sp.deleted === '1' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900">User deleted</h3>
          <p className="text-sm text-amber-700 mt-1">The account has been disabled. Profile history is preserved.</p>
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-gray-950 sm:text-[26px]">Users</h1>
          <p className="mt-1.5 text-sm leading-6 text-gray-500">
            Manage all user profiles across every portfolio in the platform.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardBody>
          <form method="GET" action="/platform-operator/users" className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="f_role" className="mb-1 block text-xs font-medium text-gray-600">Role</label>
              <select id="f_role" name="role" defaultValue={sp.role || ''} className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">All roles</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f_company" className="mb-1 block text-xs font-medium text-gray-600">Company</label>
              <select id="f_company" name="company" defaultValue={sp.company || ''} className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">All companies</option>
                {(portfolios ?? []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.company_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="f_status" className="mb-1 block text-xs font-medium text-gray-600">Status</label>
              <select id="f_status" name="status" defaultValue={sp.status || ''} className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm">
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <Button type="submit" variant="secondary" size="md">Filter</Button>
            <a href="/platform-operator/users" className="inline-flex h-10 items-center rounded-md px-3 text-sm text-gray-500 hover:text-gray-700">
              Clear
            </a>
          </form>
        </CardBody>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-950">User directory</h2>
          <p className="text-sm text-gray-500">{(users ?? []).length} users</p>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Email</TH>
              <TH>Role</TH>
              <TH>Company</TH>
              <TH>Status</TH>
              <TH>Last Login</TH>
              <TH>MFA</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {(users ?? []).length === 0 ? (
              <TR>
                <TD colSpan={8} className="py-10 text-center text-gray-500">
                  No users found matching your filters.
                </TD>
              </TR>
            ) : (
              (users ?? []).map((user: any) => (
                <TR key={user.id} className="hover:bg-gray-50">
                  <TD className="font-medium text-gray-950">
                    {user.full_name ?? user.display_name ?? '—'}
                  </TD>
                  <TD className="text-gray-900">{user.email}</TD>
                  <TD className="text-xs text-gray-600">{roleLabel(user.hoa_role)}</TD>
                  <TD className="text-gray-700">
                    {user.portfolio_id ? portfolioMap.get(user.portfolio_id) || '—' : '—'}
                  </TD>
                  <TD>{userStatusBadge(user)}</TD>
                  <TD className="text-xs text-gray-500">{date(user.last_login_at)}</TD>
                  <TD>
                    {user.mfa_enrolled_at ? (
                      <Badge className="bg-green-50 text-green-700 ring-green-200">Enabled</Badge>
                    ) : (
                      <Badge className="bg-gray-50 text-gray-500 ring-gray-200">Off</Badge>
                    )}
                  </TD>
                  <TD>
                    <div className="flex items-center gap-1 flex-wrap">
                      <form action={toggleUserDisable as any} className="inline">
                        <input type="hidden" name="user_id" value={user.id} />
                        <input type="hidden" name="action" value={user.disabled_at ? 'enable' : 'disable'} />
                        <Button type="submit" variant="ghost" size="sm">
                          {user.disabled_at ? 'Enable' : 'Disable'}
                        </Button>
                      </form>
                      <form action={changeUserRole as any} className="inline-flex items-center gap-1">
                        <input type="hidden" name="user_id" value={user.id} />
                        <select
                          name="hoa_role"
                          defaultValue={user.hoa_role || ''}
                          className="h-7 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 outline-none focus:border-blue-500"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <Button type="submit" variant="ghost" size="sm">Set</Button>
                      </form>
                      <form action={deleteUser as any} className="inline">
                        <input type="hidden" name="user_id" value={user.id} />
                        <Button type="submit" variant="ghost" size="sm">Del</Button>
                      </form>
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </section>
    </div>
  );
}
