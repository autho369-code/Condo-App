import { AccountingPage, AccountingSearchBox } from '@/components/accounting/accounting-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function GLAccountsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows } = await (supabase as any)
    .from('gl_accounts')
    .select('id, number, name, account_type, active')
    .eq('active', true)
    .order('number');

  return (
    <AccountingPage active="gl-accounts" title="Chart of Accounts">
      <div className="space-y-4">
        <AccountingSearchBox>Click here to search</AccountingSearchBox>

        {rows && rows.length > 0 ? (
          <Table>
            <THead><TR><TH>GL Account</TH><TH>Type</TH></TR></THead>
            <tbody>
              {rows.map((account: any) => (
                <TR key={account.id}>
                  <TD>
                    <a href={`/gl-accounts/${account.id}`} className="font-medium text-brand-700 hover:underline">
                      {account.number} {account.name}
                    </a>
                  </TD>
                  <TD className="text-sm capitalize text-ink-700">{account.account_type?.replace(/_/g, ' ') ?? '-'}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="border border-ink-100 bg-white px-6 py-8 text-center text-sm text-ink-500">No GL accounts configured yet.</p>
        )}
      </div>
    </AccountingPage>
  );
}
