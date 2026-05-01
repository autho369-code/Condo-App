import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/me';
import { ModulePage } from '@/components/workspace/module-page';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function BankAccountsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireStaff();
  const { filter } = await searchParams;
  const supabase = await createClient();
  let query = supabase
    .from('bank_accounts')
    .select('id, name, bank_name, account_type, payments_enabled, auto_reconciliation, last_reconciliation_date, next_check_number, associations(name)')
    .is('archived_at', null)
    .order('name');
  if (filter === 'unreconciled') query = query.is('last_reconciliation_date', null);
  const { data: rows } = await query;

  return (
    <ModulePage title={filter === 'unreconciled' ? 'Unreconciled Bank Accounts' : 'Bank Accounts'} description="Operating, reserve, and trust bank accounts used across your associations." newHref="/bank-accounts/new" newLabel="+ New Bank Account">
      {rows && rows.length > 0 ? (
        <Table>
          <THead><TR><TH>Name</TH><TH>Bank</TH><TH>Type</TH><TH>Association</TH><TH>Last reconciled</TH><TH>Flags</TH></TR></THead>
          <tbody>
            {rows.map((b: any) => (
              <TR key={b.id}>
                <TD className="font-medium">{b.name}</TD>
                <TD>{b.bank_name}</TD>
                <TD className="text-sm capitalize text-gray-700">{b.account_type?.replace(/_/g, ' ')}</TD>
                <TD className="text-sm text-gray-600">{b.associations?.name ?? '—'}</TD>
                <TD className="text-sm text-gray-600">{date(b.last_reconciliation_date)}</TD>
                <TD className="text-xs">
                  {b.payments_enabled && <span className="mr-1 rounded bg-green-100 px-1.5 py-0.5 text-green-700">payments</span>}
                  {b.auto_reconciliation && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">auto-rec</span>}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      ) : (
        <p className="rounded border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">No bank accounts configured yet.</p>
      )}
    </ModulePage>
  );
}
