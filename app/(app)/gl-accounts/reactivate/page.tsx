import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/input';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { reactivateGLAccount } from '@/lib/rpcs/accounting';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ReactivateGLAccountPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: accounts } = await (supabase as any)
    .from('gl_accounts')
    .select('id, number, name, account_type')
    .eq('active', false)
    .order('number');

  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-8 py-7">
      <main className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-ink-900">Reactivate GL Account</h1>
          <Link href="/gl-accounts" className="text-sm text-ink-600 hover:text-ink-900">Back to GL Accounts</Link>
        </div>

        <form action={reactivateGLAccount} className="space-y-4 border border-ink-100 bg-white p-5">
          <Field label="Inactive GL Account">
            <select name="gl_account_id" required className="h-10 w-full rounded-md border border-ink-200 bg-white px-3 text-sm">
              <option value="">Select account</option>
              {(accounts ?? []).map((account: any) => (
                <option key={account.id} value={account.id}>
                  {account.number} {account.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex justify-end">
            <Button type="submit" disabled={!accounts || accounts.length === 0}>Reactivate Account</Button>
          </div>
        </form>

        {accounts && accounts.length > 0 ? (
          <Table>
            <THead>
              <TR><TH>GL Account</TH><TH>Type</TH></TR>
            </THead>
            <tbody>
              {accounts.map((account: any) => (
                <TR key={account.id}>
                  <TD>{account.number} {account.name}</TD>
                  <TD className="capitalize">{account.account_type?.replace(/_/g, ' ') ?? '-'}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">
            No inactive GL accounts found.
          </p>
        )}
      </main>
    </div>
  );
}
