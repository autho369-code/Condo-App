import Link from 'next/link';
import { DataWorkspace } from '@/components/operations/data-workspace';
import { FilterBar, FilterSelect } from '@/components/operations/filter-bar';
import { PrintButton } from '@/components/ui/print-button';
import { Alert, SectionTitle } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { requireStaff } from '@/lib/auth/me';
import { createClient } from '@/lib/supabase/server';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { todayInZone } from '@/lib/time/zoned';
import { date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Financial Diagnostics: per association, the balances that should agree.
//  1. Security deposit funds: cash held for deposits (security-deposit cash
//     and trust bank accounts) vs the deposits-held liability accounts.
//  2. Escrow cash: trust/escrow bank GL balance vs the deposit liabilities,
//     and vs the offsetting side of every entry that posted to escrow cash.
//  3. Security clearing accounts: any non-zero balance, plus unpaid bills
//     coded to a clearing account.
//  4. Additional fee GL accounts with a balance left in them.
//  5. Homeowners holding unused credit while charges are still open.
//  6. Prepayment GL balance vs homeowners' unused credit.
//  7. Bank accounts not reconciled in over 60 days.
//  8. Unused credit left on a unit from before the current owner bought it.

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

  const [{ data: assocRows }, { data: glRows }, { data: bankRows }, { data: feeRows }, creditRes] = await Promise.all([
    db.from('associations').select('id, name').is('archived_at', null).order('name'),
    db.from('gl_accounts').select('id, name, number, account_type'),
    db.from('bank_accounts').select('id, name, gl_account_id, association_id, purpose, last_reconciliation_date').is('archived_at', null),
    db.from('association_additional_fees').select('id, association_id, gl_account_id, label').not('gl_account_id', 'is', null),
    // Units holding unused (unapplied) homeowner credit.
    fetchAllRows<any>(() => db
      .from('v_unit_account_summary')
      .select('unit_id, unit_number, association_id, outstanding_balance, unapplied_credit')
      .gt('unapplied_credit', 0)
      .order('unit_id')),
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
  const fees = ((feeRows ?? []) as any[]);
  const feeGlIds = [...new Set(fees.map((f) => f.gl_account_id as string))];
  const prepaidGlIds = gls.filter((g) => g.account_type === 'liability' && /prepaid|prepayment/i.test(g.name)).map((g) => g.id);
  const glName = new Map(gls.map((g) => [g.id, `${g.number ?? ''} ${g.name}`.trim()]));

  const balanceIds = [...new Set([...depositCashGlIds, ...depositLiabilityGlIds, ...clearingGlIds, ...escrowGlIds, ...feeGlIds, ...prepaidGlIds])];
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
  const loadError = balancesRes.error?.message ?? offsetRes.error?.message ?? billsRes.error ?? creditRes.error ?? null;

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

  // 4. Additional fee accounts that still hold a balance.
  const assocById = new Map(associations.map((a) => [a.id, a]));
  const feeRowsOut = fees
    .filter((f) => assocById.has(f.association_id))
    .map((f) => ({ id: f.id, a: assocById.get(f.association_id)!, label: f.label ?? 'Additional fee', gl: glName.get(f.gl_account_id) ?? '—', balance: sumDebit(f.association_id, [f.gl_account_id]) }))
    .filter((r) => differs(r.balance, 0));

  // 5, 6, 8. Unused homeowner credit.
  const credits = (creditRes.rows as any[]).filter((u) => assocIds.has(u.association_id));
  const creditUnitIds = credits.map((u) => u.unit_id as string);
  const ownersByUnit = new Map<string, { names: string[]; moveIn: string | null }>();
  const lastPaymentByUnit = new Map<string, string>();
  if (creditUnitIds.length) {
    const [{ rows: occ }, { rows: pays }] = await Promise.all([
      fetchAllRows<any>(() => db.from('occupancies')
        .select('id, unit_id, move_in_date, owners(full_name)')
        .in('unit_id', creditUnitIds).eq('status', 'current').eq('occupancy_type', 'owner').order('id')),
      fetchAllRows<any>(() => db.from('payments').select('id, unit_id, payment_date').in('unit_id', creditUnitIds).order('id')),
    ]);
    for (const o of occ) {
      const cur = ownersByUnit.get(o.unit_id) ?? { names: [], moveIn: null };
      if (o.owners?.full_name) cur.names.push(o.owners.full_name);
      if (o.move_in_date && (!cur.moveIn || o.move_in_date < cur.moveIn)) cur.moveIn = o.move_in_date;
      ownersByUnit.set(o.unit_id, cur);
    }
    for (const pmt of pays) {
      const prev = lastPaymentByUnit.get(pmt.unit_id);
      if (!prev || pmt.payment_date > prev) lastPaymentByUnit.set(pmt.unit_id, pmt.payment_date);
    }
  }
  const creditRow = (u: any) => ({
    ...u,
    a: assocById.get(u.association_id)!,
    owner: (ownersByUnit.get(u.unit_id)?.names ?? []).join(', ') || '—',
    credit: Number(u.unapplied_credit ?? 0),
    open: Number(u.outstanding_balance ?? 0),
  });
  const creditOpenRows = credits.filter((u) => Number(u.outstanding_balance ?? 0) > 0.004).map(creditRow);
  // Credit left over from a previous owner: the unit's last payment was made
  // before the current owner moved in.
  const pastOwnerRows = credits
    .filter((u) => {
      const moveIn = ownersByUnit.get(u.unit_id)?.moveIn;
      const lastPay = lastPaymentByUnit.get(u.unit_id);
      return moveIn && lastPay && lastPay < moveIn;
    })
    .map((u) => ({ ...creditRow(u), moveIn: ownersByUnit.get(u.unit_id)?.moveIn ?? null, lastPay: lastPaymentByUnit.get(u.unit_id) ?? null }));
  const creditByAssoc = new Map<string, number>();
  for (const u of credits) creditByAssoc.set(u.association_id, (creditByAssoc.get(u.association_id) ?? 0) + Number(u.unapplied_credit ?? 0));
  // Prepayments stay in Accounts Receivable here, so a prepaid-assessments
  // liability balance is only listed when it disagrees with homeowners' credit.
  const prepaidRows = associations
    .map((a) => ({ a, gl: -sumDebit(a.id, prepaidGlIds), credit: creditByAssoc.get(a.id) ?? 0 }))
    .filter((r) => prepaidGlIds.length > 0 && differs(r.gl, 0) && differs(r.gl, r.credit));

  // 7. Reconciliation lapses over 60 days.
  const today = todayInZone();
  const [ty, tm, td] = today.split('-').map(Number);
  const cutoff = new Date(Date.UTC(ty, tm - 1, td - 60)).toISOString().slice(0, 10);
  const lapseRows = banks
    .filter((b) => assocById.has(b.association_id) && (!b.last_reconciliation_date || b.last_reconciliation_date < cutoff))
    .map((b) => ({ id: b.id, a: assocById.get(b.association_id)!, name: b.name as string, last: b.last_reconciliation_date as string | null }))
    .sort((x, y) => x.a.name.localeCompare(y.a.name) || x.name.localeCompare(y.name));

  const property = (a: Assoc) => (
    <Link href={`/associations/${a.id}`} className="font-medium text-gray-900 hover:underline">{a.name}</Link>
  );
  const none = (cols: number, text = 'No Mismatched Balances') => (
    <TR><TD colSpan={cols} className="py-6 text-center text-gray-500">{text}</TD></TR>
  );

  return (
    <DataWorkspace
      title="Financial Diagnostics"
      description="Balances and records that need attention, by association. Each section lists only the items with a problem."
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

        <section>
          <SectionTitle title="Negative / Positive Balance on Additional Fee GL Accounts" description="Accounts used for additional fees should not carry a balance." />
          <Table>
            <THead><TR><TH>Property</TH><TH>Additional Fee</TH><TH>GL Account</TH><TH className="text-right">Balance</TH></TR></THead>
            <tbody>
              {feeRowsOut.length === 0 ? none(4, 'No Balances') : feeRowsOut.map((r) => (
                <TR key={r.id}>
                  <TD>{property(r.a)}</TD>
                  <TD>{r.label}</TD>
                  <TD className="text-gray-600">{r.gl}</TD>
                  <TD className="text-right tabular-nums">{amount(r.balance)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>

        <section>
          <SectionTitle title="Homeowners With Unused Prepayments / Open Charges / Open Credits" description="Credit on file that could be applied to the homeowner's open charges." />
          <Table>
            <THead><TR><TH>Property</TH><TH>Unit</TH><TH>Homeowner</TH><TH className="text-right">Open Charges</TH><TH className="text-right">Unused Credit</TH></TR></THead>
            <tbody>
              {creditOpenRows.length === 0 ? none(5, 'No Homeowners') : creditOpenRows.map((r) => (
                <TR key={r.unit_id}>
                  <TD>{property(r.a)}</TD>
                  <TD><Link href={`/units/${r.unit_id}`} className="hover:underline">{r.unit_number ?? '—'}</Link></TD>
                  <TD>{r.owner}</TD>
                  <TD className="text-right tabular-nums">{amount(r.open)}</TD>
                  <TD className="text-right tabular-nums">{amount(r.credit)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>

        <section>
          <SectionTitle title="Prepayment Balance Mismatch" description="Prepaid assessments/dues accounts compared with homeowners' unused credit." />
          <Table>
            <THead><TR><TH>Property</TH><TH className="text-right">Prepayment GL Balance</TH><TH className="text-right">Homeowner Unused Credit</TH></TR></THead>
            <tbody>
              {prepaidRows.length === 0 ? none(3) : prepaidRows.map((r) => (
                <TR key={r.a.id}>
                  <TD>{property(r.a)}</TD>
                  <TD className="text-right tabular-nums">{amount(r.gl)}</TD>
                  <TD className="text-right tabular-nums">{amount(r.credit)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>

        <section>
          <SectionTitle title="Bank Account Reconciliation Lapses Over 60 Days" description={`Not reconciled since before ${date(cutoff)}.`} />
          <Table>
            <THead><TR><TH>Property</TH><TH>Bank Account</TH><TH>Last Reconciled</TH></TR></THead>
            <tbody>
              {lapseRows.length === 0 ? none(3, 'No Lapses') : lapseRows.map((r) => (
                <TR key={r.id}>
                  <TD>{property(r.a)}</TD>
                  <TD><Link href={`/bank-accounts/${r.id}`} className="hover:underline">{r.name}</Link></TD>
                  <TD>{r.last ? date(r.last) : 'Never'}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>

        <section>
          <SectionTitle title="Unused Prepayments for Past Owners" description="Credit on a unit whose last payment was made before the current owner moved in." />
          <Table>
            <THead><TR><TH>Property</TH><TH>Unit</TH><TH>Current Owner</TH><TH>Last Payment</TH><TH>Owner Since</TH><TH className="text-right">Unused Credit</TH></TR></THead>
            <tbody>
              {pastOwnerRows.length === 0 ? none(6, 'No Past-Owner Credits') : pastOwnerRows.map((r) => (
                <TR key={r.unit_id}>
                  <TD>{property(r.a)}</TD>
                  <TD><Link href={`/units/${r.unit_id}`} className="hover:underline">{r.unit_number ?? '—'}</Link></TD>
                  <TD>{r.owner}</TD>
                  <TD>{date(r.lastPay)}</TD>
                  <TD>{date(r.moveIn)}</TD>
                  <TD className="text-right tabular-nums">{amount(r.credit)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </section>
      </div>
    </DataWorkspace>
  );
}
