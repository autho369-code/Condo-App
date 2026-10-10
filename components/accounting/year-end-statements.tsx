import { money } from '@/lib/utils';

type Line = { number?: number | null; name: string; fund?: string | null; balance?: number };
type Snapshot = any;

function Table({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] print:break-inside-avoid print:rounded-none print:border-gray-300 print:shadow-none">
      <div className="border-b border-gray-100 px-5 py-3"><h2 className="text-sm font-semibold text-gray-900">{title}</h2></div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const th = 'px-4 py-2 text-left text-[12.5px] font-semibold uppercase tracking-wide text-gray-500';
const td = 'px-4 py-1.5 text-[13px] text-gray-800';
const num = 'px-4 py-1.5 text-right text-[13px] tabular-nums text-gray-900';
const acct = (l: Line) => `${l.number ?? ''} ${l.name}`.trim();

function Rows({ lines }: { lines: Line[] }) {
  return <>{lines.map((l, i) => <tr key={i} className="border-t border-gray-100"><td className={td}>{acct(l)}</td><td className={num}>{money(l.balance ?? 0)}</td></tr>)}</>;
}
function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <tr className={`border-t border-gray-200 ${strong ? 'bg-gray-50 font-semibold' : 'font-medium'}`}><td className={td}>{label}</td><td className={num}>{money(value)}</td></tr>;
}

/** Renders a frozen year-end snapshot. Never reads live data. */
export function YearEndStatements({ snapshot: s }: { snapshot: Snapshot }) {
  const bs = s.balance_sheet ?? {};
  const is = s.income_statement ?? {};
  const liabilities = Number(bs.total_liabilities ?? 0);
  const equity = Number(bs.total_equity ?? 0);

  return (
    <div>
      <Table title={`Balance sheet — as of ${s.period_end}`}>
        <table className="w-full">
          <tbody>
            <tr><td className={`${th} pt-3`} colSpan={2}>Assets</td></tr>
            <Rows lines={bs.assets ?? []} />
            <Total label="Total assets" value={Number(bs.total_assets ?? 0)} strong />
            <tr><td className={`${th} pt-4`} colSpan={2}>Liabilities</td></tr>
            <Rows lines={bs.liabilities ?? []} />
            <Total label="Total liabilities" value={liabilities} />
            <tr><td className={`${th} pt-4`} colSpan={2}>Fund balance / equity</td></tr>
            <Rows lines={bs.equity ?? []} />
            <tr className="border-t border-gray-100"><td className={td}>Accumulated surplus — prior years</td><td className={num}>{money(bs.accumulated_surplus_prior_years ?? 0)}</td></tr>
            <tr className="border-t border-gray-100"><td className={td}>Net income — fiscal {s.fiscal_year}</td><td className={num}>{money(bs.net_income_current_year ?? 0)}</td></tr>
            <Total label="Total fund balance" value={equity} />
            <Total label="Total liabilities and fund balance" value={liabilities + equity} strong />
          </tbody>
        </table>
        {!bs.balanced && <p className="px-5 py-2 text-[12px] font-medium text-red-700">The balance sheet does not balance. Review the trial balance before finalizing.</p>}
      </Table>

      <Table title={`Income statement vs budget — ${s.period_start} to ${s.period_end}`}>
        <table className="w-full">
          <thead><tr><th className={th}>Account</th><th className={`${th} text-right`}>Actual</th><th className={`${th} text-right`}>Budget</th><th className={`${th} text-right`}>Variance</th></tr></thead>
          <tbody>
            {['income', 'expense'].map((sec) => (
              <FragmentRows key={sec} section={sec} lines={(is.lines ?? []).filter((l: any) => l.section === sec)}
                actual={sec === 'income' ? is.total_income : is.total_expense} budget={sec === 'income' ? is.budget_income : is.budget_expense} />
            ))}
            <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
              <td className={td}>Net income</td><td className={num}>{money(is.net_income ?? 0)}</td><td className={num}>{money(is.budget_net ?? 0)}</td>
              <td className={num}>{money(Number(is.net_income ?? 0) - Number(is.budget_net ?? 0))}</td>
            </tr>
          </tbody>
        </table>
      </Table>

      {(s.funds ?? []).length > 0 && (
        <Table title="Results by fund">
          <table className="w-full">
            <thead><tr><th className={th}>Fund</th><th className={`${th} text-right`}>Income</th><th className={`${th} text-right`}>Expense</th><th className={`${th} text-right`}>Net</th></tr></thead>
            <tbody>{s.funds.map((f: any) => (
              <tr key={f.fund} className="border-t border-gray-100"><td className={`${td} capitalize`}>{String(f.fund).replace(/_/g, ' ')}</td><td className={num}>{money(f.income ?? 0)}</td><td className={num}>{money(f.expense ?? 0)}</td><td className={num}>{money(f.net ?? 0)}</td></tr>
            ))}</tbody>
          </table>
        </Table>
      )}

      <div className="grid gap-6 lg:grid-cols-2 print:grid-cols-2">
        <Table title={`Owner receivables — ${s.receivables?.accounts ?? 0} accounts, ${money(s.receivables?.total ?? 0)}`}>
          <table className="w-full">
            <tbody>
              {(s.receivables?.units ?? []).slice(0, 50).map((u: any, i: number) => (
                <tr key={i} className="border-t border-gray-100"><td className={td}>Unit {u.unit}</td><td className={num}>{money(u.balance)}</td></tr>
              ))}
              {(s.receivables?.units ?? []).length === 0 && <tr><td className={td}>No owner balances outstanding at year end.</td></tr>}
            </tbody>
          </table>
        </Table>
        <Table title="Bank accounts">
          <table className="w-full">
            <tbody>{(s.bank_accounts ?? []).map((b: any, i: number) => (
              <tr key={i} className="border-t border-gray-100">
                <td className={td}>{b.name}<div className="text-[12.5px] text-gray-400">{b.purpose ?? 'operating'} · reconciled through {b.reconciled_through ?? '—'}</div></td>
                <td className={num}>{money(b.balance)}</td>
              </tr>
            ))}</tbody>
          </table>
        </Table>
      </div>

      <Table title={`Trial balance — fiscal ${s.fiscal_year} activity`}>
        <table className="w-full">
          <thead><tr><th className={th}>Account</th><th className={`${th} text-right`}>Debit</th><th className={`${th} text-right`}>Credit</th></tr></thead>
          <tbody>
            {(s.trial_balance ?? []).map((l: any, i: number) => (
              <tr key={i} className="border-t border-gray-100"><td className={td}>{acct(l)}</td><td className={num}>{Number(l.debit) ? money(l.debit) : ''}</td><td className={num}>{Number(l.credit) ? money(l.credit) : ''}</td></tr>
            ))}
            <tr className="border-t border-gray-200 bg-gray-50 font-semibold">
              <td className={td}>Totals</td>
              <td className={num}>{money((s.trial_balance ?? []).reduce((a: number, l: any) => a + Number(l.debit ?? 0), 0))}</td>
              <td className={num}>{money((s.trial_balance ?? []).reduce((a: number, l: any) => a + Number(l.credit ?? 0), 0))}</td>
            </tr>
          </tbody>
        </table>
      </Table>
    </div>
  );
}

function FragmentRows({ section, lines, actual, budget }: { section: string; lines: any[]; actual: number; budget: number }) {
  return (
    <>
      <tr><td className={`${th} pt-3`} colSpan={4}>{section === 'income' ? 'Income' : 'Expenses'}</td></tr>
      {lines.map((l, i) => (
        <tr key={i} className="border-t border-gray-100">
          <td className={td}>{acct(l)}</td><td className={num}>{money(l.actual)}</td><td className={num}>{money(l.budget)}</td>
          <td className={`${num} ${Number(l.variance) < 0 ? 'text-red-700' : ''}`}>{money(l.variance)}</td>
        </tr>
      ))}
      <tr className="border-t border-gray-200 font-medium">
        <td className={td}>Total {section === 'income' ? 'income' : 'expenses'}</td><td className={num}>{money(actual ?? 0)}</td><td className={num}>{money(budget ?? 0)}</td>
        <td className={num}>{money(section === 'income' ? Number(actual ?? 0) - Number(budget ?? 0) : Number(budget ?? 0) - Number(actual ?? 0))}</td>
      </tr>
    </>
  );
}
