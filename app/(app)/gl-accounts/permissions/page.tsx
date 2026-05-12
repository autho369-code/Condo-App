import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { setGLAccountPermission } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const permissions = [
  { value: 'none', label: 'None' },
  { value: 'read', label: 'Read' },
  { value: 'full', label: 'Full' },
];

export default async function GLAccountPermissionsPage() {
  await requireStaff();
  const supabase = await createClient();

  const [{ data: accounts }, { data: roles }, { data: rows }] = await Promise.all([
    (supabase as any)
      .from('gl_accounts')
      .select('id, number, name, active')
      .eq('active', true)
      .order('number'),
    (supabase as any)
      .from('user_roles')
      .select('id, name')
      .order('name'),
    (supabase as any)
      .from('gl_account_role_permissions')
      .select('id, permission, gl_accounts(number, name), user_roles(name)')
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Manage GL Account Permissions</h1>
          <Link href="/gl-accounts" className="text-sm text-ink-600 hover:text-ink-900">Back to GL Accounts</Link>
        </div>

        <form action={setGLAccountPermission} className="space-y-4 border border-ink-100 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_160px]">
            <Field label="GL Account">
              <select name="gl_account_id" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Select account</option>
                {(accounts ?? []).map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.number} {account.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Role">
              <select name="role_id" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                <option value="">Select role</option>
                {(roles ?? []).map((role: any) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Permission">
              <select name="permission" defaultValue="read" className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
                {permissions.map((permission) => (
                  <option key={permission.value} value={permission.value}>{permission.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex justify-end">
            <Button type="submit">Save Permission</Button>
          </div>
        </form>

        {rows && rows.length > 0 ? (
          <Table>
            <THead>
              <TR><TH>GL Account</TH><TH>Role</TH><TH>Permission</TH></TR>
            </THead>
            <tbody>
              {rows.map((row: any) => (
                <TR key={row.id}>
                  <TD>{row.gl_accounts ? `${row.gl_accounts.number} ${row.gl_accounts.name}` : '-'}</TD>
                  <TD>{row.user_roles?.name ?? '-'}</TD>
                  <TD className="capitalize">{row.permission}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">
            No GL account permissions configured yet.
          </p>
        )}
      </main>
    </div>
  );
}
