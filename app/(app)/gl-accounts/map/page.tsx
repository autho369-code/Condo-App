import Link from 'next/link';
import { requireFinanceStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { PendingSubmit } from '@/components/ui/pending-submit';
import { Alert } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { GL_MAP_KEYS } from '@/lib/gl/accounts';
import { setGlAccountMap } from '@/lib/rpcs/gl-map';

export const dynamic = 'force-dynamic';

// GL account map: the default accounts system postings use (charges,
// receipts, assessments, late fees, bills and checks).
export default async function GlAccountMapPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const me = await requireFinanceStaff();
  const sp = await searchParams;
  const db = (await createClient()) as any;
  const [{ data: mapRows, error: mapError }, { rows: accounts, error: accountsError }] = await Promise.all([
    db.from('gl_account_map').select('map_key, gl_account_id, updated_at').eq('portfolio_id', me.portfolio?.id).is('association_id', null),
    fetchAllRows<any>(() => db.from('gl_accounts')
      .select('id, number, name, account_type')
      .eq('portfolio_id', me.portfolio?.id).is('association_id', null).eq('active', true)
      .order('number').order('id')),
  ]);
  if (mapError) throw new Error(`Could not load the GL account map: ${mapError.message}`);
  if (accountsError) throw new Error(`Could not load GL accounts: ${accountsError}`);
  const mapped = new Map((mapRows ?? []).map((r: any) => [r.map_key, r.gl_account_id]));

  return (
    <DataWorkspace
      title="GL Account Map"
      description="Choose the default accounts that charges, receipts, assessments, late fees, bills and checks post to."
      actions={<Link href="/gl-accounts"><Button variant="secondary">Back to GL accounts</Button></Link>}
    >
      <div className="space-y-5">
        {sp.error && <Alert tone="danger" title="Could not save the default">{sp.error}</Alert>}
        {sp.saved && <Alert tone="success" title="Default saved">New postings use this account. Entries already posted are not changed.</Alert>}
        <Alert tone="info" title="When a default is not set">
          Postings pick an account by its type, number and name. A charge category or bank account with its own GL account always uses that account.
        </Alert>
        <Table>
          <THead>
            <tr>
              <TH>Default</TH>
              <TH>Used for</TH>
              <TH className="w-[420px]">Account</TH>
            </tr>
          </THead>
          <tbody>
            {GL_MAP_KEYS.map((k) => {
              const options = accounts.filter((a: any) => k.types.includes(a.account_type));
              const current = mapped.get(k.key) as string | undefined;
              return (
                <TR key={k.key}>
                  <TD className="font-medium text-gray-900">{k.label}</TD>
                  <TD className="text-gray-600">{k.hint}</TD>
                  <TD>
                    <form action={setGlAccountMap} className="flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="map_key" value={k.key} />
                      <Select name="gl_account_id" defaultValue={current ?? ''} required aria-label={k.label}>
                        <option value="" disabled>Not set</option>
                        {options.map((a: any) => <option key={a.id} value={a.id}>{a.number} · {a.name}</option>)}
                      </Select>
                      <PendingSubmit variant="secondary" pendingLabel="Saving…">Save</PendingSubmit>
                    </form>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </div>
    </DataWorkspace>
  );
}
