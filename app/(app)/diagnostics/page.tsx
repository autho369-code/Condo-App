import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { PrintButton } from '@/components/ui/print-button';
import { Alert, SectionTitle } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

export const dynamic = 'force-dynamic';

// Financial Diagnostics: per association, the balances that should agree.
//  1. Security deposit funds: cash held for deposits (security-deposit cash
//     and trust bank accounts) vs the deposits-held liability accounts.
//  2. Escrow cash: trust/escrow bank GL balance vs the deposit liabilities,
//     and vs the offsetting side of every entry that posted to escrow cash.
//  3. Security clearing accounts: any non-zero balance, plus unpaid bills
//     coded to a clearing account.

type Assoc = { id: string; name: string };
type Gl = { id: string; name: string; number: number | null; account_type: string };

const amount = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const differs = (a: number, b: number) => Math.abs(a - b) >= 0.005;

export default async function FinancialDiagnosticsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; association?: string }>;
}) {
  await requireStaff();
  const { q = '', association = '' } = await searchParams;
  const db = (await createClient()) as any;

  const [{ data: assocRows }, { data: glRows }, { data: bankRows }] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('gl_accounts').select('id, name, number, account_type'),
    db.from('bank_accounts').select('id, name, gl_account_id, association_id, purpose').is('archived_at', null),
  ]);
  const allAssociations = (assocRows ?? []) as Assoc[];
  const needle = q.trim().toLowerCase();
  const associations = allAssociations.filter((a) =>
    (!association || a.id === association) && (!needle || a.name.toLowerCase().includes(needle)));
  const assocIds = new Set(associations.map((a) => a.id));

  const gls = (glRows ?? []) as Gl[];
  const banks = (bankRows ?? []) as any[];
  const trustGlIds = banks.filter((b) => b.purpose === 'trust' && b.gl_account_id).map((b) => b.gl_account_id as string);
  const escrowGlIds = [...new Set([
    ...trustGlIds,
    ...gls.filter((g) => g.account_type === 'cash' && /escrow/i.test(g.name)).map((g) => g.id),
  ])];
  const depositCashGlIds = [...new Set([
    ...trustGlIds,
    ...gls.filter((g) => g.account_type === 'cash' && /security deposit/i.test(g.name)).map((g) => g.id),
  ])];
  const depositLiabilityGlIds = gls
    .filter((g) => g.account_type === 'liability' && /(deposits? held|security deposit)/i.test(g.name))
    .map((g) => g.id);
  const clearingGlIds = gls.filter((g) => /clearing/i.test(g.name)).map((g) => g.id);

  const balanceIds = [...new Set([...depositCashGlIds, ...depositLiabilityGlIds, ...clearingGlIds, ...escrowGlIds])];
  const [balancesRes, offsetRes, billsRes] = await Promise.all([
    balanceIds.length ? db.rpc('gl_balances_by_association', { p_gl_account_ids: balanceIds }) : { data: [], error: null },
    escrowGlIds.length ? db.rpc('escrow_offset_by_association', { p_escrow_gl_ids: escrowGlIds }) : { data: [], error: null },
    clearingGlIds.length
      ? fetchAllRows<any>(() => db
          .from('payable_bills')
          .select('id, association_id, amount, credit_applied, status')
          .in('gl_account_id', clearingGlIds)
          .is('archived_at', null)
          .not('status', 'in', '("paid","void")')
          .order('id'))
      : Promise.resolve({ rows: [], truncated: false, error: null }),
  ]);
  const loadError = balancesRes.error?.message ?? offsetRes.error?.message ?? billsRes.error ?? null;

  // association → (gl → debit-minus-credit)
  const bal = new Map<string, Map<string, number>>();
  for (const r of (balancesRes.data ?? []) as any[]) {
    if (!r.association_id) continue;
    const m = bal.get(r.association_id) ?? new Map<string, number>();
    m.set(r.gl_account_id, (m.get(r.gl_account_id) ?? 0) + Number(r.debit_minus_credit ?? 0));
    bal.set(r.association_id, m);
  }
  const sumDebit = (assocId: string, ids: string[]) =>
    ids.reduce((s, id) => s + (bal.get(assocId)?.get(id) ?? 0), 0);
  const offsets = new Map<string, number>(
    ((offsetRes.data ?? []) as any[]).map((r) => [r.association_id, Number(r.offset_balance ?? 0)]));
  const unpaidClearing = new Map<string, number>();
  for (const b of billsRes.rows as any[]) {
    unpaidClearing.set(b.association_id, (unpaidClearing.get(b.association_id) ?? 0)
      + Number(b.amount ?? 0) - Number(b.credit_applied ?? 0));
  }

  const depositRows = associations
    .map((a) => ({
      a,
      ledger: sumDebit(a.id, depositCashGlIds),
      funds: -sumDebit(a.id, depositLiabilityGlIds),
    }))
    .filter((r) => differs(r.ledger, r.funds));

  const escrowRows = associations
    .map((a) => ({
      a,
      escrow: sumDebit(a.id, escrowGlIds),
      deposits: -sumDebit(a.id, depositLiabilityGlIds),
      offset: offsets.get(a.id) ?? 0,
    }))
    .filter((r) => escrowGlIds.length > 0 && (differs(r.escrow, r.deposits) || differs(r.escrow, r.offset)));

  const clearingRows = associations
    .map((a) => ({ a, balance: sumDebit(a.id, clearingGlIds), unpaid: unpaidClearing.get(a.id) ?? 0 }))
    .filter((r) => differs(r.balance, 0) || differs(r.unpaid, 0));

  const property = (a: Assoc) => (
    <Link href={`/associations/${a.id}`} className="font-medium text-gray-900 hover:underline">{a.name}</Link>
  );
  const none = (cols: number) => (
    <TR><TD colSpan={cols} className="py-6 text-center text-gray-500">No Mismatched Balances</TD></TR>
  );

  return (
    <DataWorkspace
      title="Financial Diagnostics"
      description="Balances that should agree, by association. Only associations with a mismatch are listed."
      actions={<PrintButton />}
    >
      <div className="space-y-6">
        {loadError && <Alert title="Some balances could not be loaded.">{loadError}</Alert>}
        {billsRes.truncated && <Alert title="Unpaid clearing bills are incomplete.">More than the row limit matched; narrow to one association.</Alert>}

        <FilterBar action="/diagnostics" searchDefault={q} searchPlaceholder="Search by property">
          <FilterSelect label="Properties" name="association" defaultValue={association}>
            <option value="">Show All Properties</option>
            {allAssociations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </FilterSelect>
        </FilterBar>

        <section>
          <SectionTitle title="Security Deposit Funds Mismatch" description="Cash held for deposits compared with the deposits-held liability." />
          <Table>
            <THead><TR><TH>Property</TH><TH className="text-right">Deposit Account Balance (General Ledger)</TH><TH className="text-right">Deposit Account Balance (Security Deposit Funds)</TH></TR></THead>
            <tbody>
              {depositRows.length === 0 ? none(3) : depositRows.map((r) => (
                <TR key={r.a.id}>
                  <TD>{property(r.a)}</TD>
                  <TD className="text-right tabular-nums">{amount(r.ledger)}</TD>
                  <TD className="text-right tabular-nums">{amount(r.funds)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>

        <section>
          <SectionTitle title="Escrow Cash Account Balance Mismatch" description="Escrow (trust) cash compared with deposit liabilities and with everything posted against escrow cash." />
          <Table>
            <THead><TR><TH>Property</TH><TH className="text-right">Escrow Cash GL Balance</TH><TH className="text-right">Deposit GL Accounts</TH><TH className="text-right">All GL Accounts w/ Escrow Cash Offset</TH></TR></THead>
            <tbody>
              {escrowRows.length === 0 ? none(4) : escrowRows.map((r) => (
                <TR key={r.a.id}>
                  <TD>{property(r.a)}</TD>
                  <TD className="text-right tabular-nums">{amount(r.escrow)}</TD>
                  <TD className="text-right tabular-nums">{amount(r.deposits)}</TD>
                  <TD className="text-right tabular-nums">{amount(r.offset)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>

        <section>
          <SectionTitle title="Non-Zero Security Clearing Account Balances" description="Clearing accounts should net to zero once bills are paid." />
          <Table>
            <THead><TR><TH>Property</TH><TH className="text-right">Security Clearing Account Balance</TH><TH className="text-right">Unpaid Security Clearing Bill Balance</TH></TR></THead>
            <tbody>
              {clearingRows.length === 0 ? none(3) : clearingRows.map((r) => (
                <TR key={r.a.id}>
                  <TD>{property(r.a)}</TD>
                  <TD className="text-right tabular-nums">{amount(r.balance)}</TD>
                  <TD className="text-right tabular-nums">{amount(r.unpaid)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>
      </div>
    </DataWorkspace>
  );
}
