import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Workspace, WorkspaceHeader, Section, Tile } from '@/components/reports/workspace';
import { Button } from '@/components/ui/button';
import { queueReport } from '@/lib/rpcs/reports';
import { money, date } from '@/lib/utils';

export const dynamic = 'force-dynamic';

// Category labels for the breadcrumb eyebrow
const CATEGORY_LABELS: Record<string, string> = {
  accounting:    'Accounting',
  association:   'Association & HOA',
  property_unit: 'Property & units',
  people:        'People',
  maintenance:   'Maintenance',
  compliance:    'Compliance',
  communication: 'Communication',
};

// ── Slugs that render live inline reports ──
const LIVE_REPORT_SLUGS = [
  'trial_balance',
  'balance_sheet',
  'income_statement',
  'cash_flow',
  'general_ledger',
] as const;

type LiveReportSlug = (typeof LIVE_REPORT_SLUGS)[number];

export default async function ReportView({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preset?: string; from?: string; to?: string; association?: string; scope?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: def } = await (supabase as any)
    .from('report_definitions')
    .select('id, slug, name, category, description, output_formats')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();

  if (!def) notFound();

  const [{ data: runs }, { data: associations }] = await Promise.all([
    (supabase as any).from('report_runs')
      .select('id, status, output_format, output_url, row_count, duration_ms, created_at')
      .eq('definition_id', def.id)
      .order('created_at', { ascending: false })
      .limit(10),
    (supabase as any).from('associations')
      .select('id, name, created_at')
      .is('archived_at', null)
      .order('name'),
  ]);

  const period = computePeriod(sp.preset ?? 'this_month', sp.from, sp.to);

  const ctx = {
    def,
    runs: runs ?? [],
    associations: associations ?? [],
    period,
    selectedAssociation: sp.association ?? '',
    selectedPreset: sp.preset ?? 'this_month',
    selectedScope: sp.scope ?? 'association',
  };

  // ── Dispatch to live report or queued view ──
  if (def.slug === 'ar_aging') {
    return <ARAgingView {...ctx} />;
  }
  if ((LIVE_REPORT_SLUGS as readonly string[]).includes(def.slug)) {
    return <LiveReportView {...ctx} slug={def.slug as LiveReportSlug} />;
  }
  return <QueuedReportView {...ctx} />;
}

// ═══════════════════════════════════════════════════════════════
// LIVE REPORT DISPATCHER
// ═══════════════════════════════════════════════════════════════
async function LiveReportView(
  ctx: ReportContext & { slug: LiveReportSlug },
) {
  switch (ctx.slug) {
    case 'trial_balance':     return <TrialBalanceView {...ctx} />;
    case 'balance_sheet':     return <BalanceSheetView {...ctx} />;
    case 'income_statement':  return <IncomeStatementView {...ctx} />;
    case 'cash_flow':         return <CashFlowView {...ctx} />;
    case 'general_ledger':    return <GeneralLedgerView {...ctx} />;
    default:                  return <QueuedReportView {...ctx} />;
  }
}

type ReportContext = {
  def: any; runs: any[]; associations: any[]; period: Period;
  selectedAssociation: string; selectedPreset: string; selectedScope: string;
};

// ═══════════════════════════════════════════════════════════════
// 1. TRIAL BALANCE
// ═══════════════════════════════════════════════════════════════
async function TrialBalanceView({
  def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope,
}: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;

  // Fetch active GL accounts with their journal line totals
  let q = db
    .from('gl_accounts')
    .select('id, number, name, account_type, active')
    .eq('active', true)
    .order('number');

  const { data: glAccounts } = await q;
  const accounts = (glAccounts ?? []) as any[];

  // Fetch journal_lines joined with journal_entries for the period
  let lineQuery = db
    .from('journal_lines')
    .select('id, debit_amount, credit_amount, gl_account_id, entry_id, journal_entries!inner(entry_date, posted)')
    .eq('journal_entries.posted', true);

  if (selectedAssociation) {
    lineQuery = lineQuery.eq('association_id', selectedAssociation);
  }
  lineQuery = lineQuery
    .gte('journal_entries.entry_date', period.from)
    .lte('journal_entries.entry_date', period.to);

  const { data: lines } = await lineQuery;
  const journalLines = (lines ?? []) as any[];

  // Aggregate debits/credits per gl_account
  const totals: Record<string, { debit: number; credit: number }> = {};
  for (const acc of accounts) {
    totals[acc.id] = { debit: 0, credit: 0 };
  }
  for (const line of journalLines) {
    const accId = line.gl_account_id;
    if (!totals[accId]) totals[accId] = { debit: 0, credit: 0 };
    totals[accId].debit  += Number(line.debit_amount ?? 0);
    totals[accId].credit += Number(line.credit_amount ?? 0);
  }

  // Compute balance: Assets/Expenses = debit-positive; Liabilities/Equity/Income = credit-positive
  const getBalance = (acc: any) => {
    const t = totals[acc.id] ?? { debit: 0, credit: 0 };
    return { debit: t.debit, credit: t.credit, net: t.debit - t.credit };
  };

  const totalDebit  = accounts.reduce((s, a) => s + getBalance(a).debit, 0);
  const totalCredit = accounts.reduce((s, a) => s + getBalance(a).credit, 0);

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/reports" className="transition-colors hover:text-gray-700">Reports</Link>
              {' \u00B7 '}
              <span className="text-gray-400">{CATEGORY_LABELS[def.category] ?? def.category}</span>
              {' \u00B7 '}
              <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold uppercase text-green-700">live</span>
            </>
          }
          title={def.name}
          subtitle={def.description}
        />
      }
      rail={<ReportRightRail def={def} runs={runs} associations={associations} period={period}
        selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} selectedScope={selectedScope} isLive />}
    >
      <div className="space-y-4">
        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-3">
          <Tile label="Total Debits"  value={money(totalDebit)}  tone="neutral" sub="Sum of all debit entries" />
          <Tile label="Total Credits" value={money(totalCredit)} tone="neutral" sub="Sum of all credit entries" />
          <Tile label="GL Accounts"   value={accounts.length}     tone="neutral" sub="Active accounts" />
          <Tile label="Period"        value={period.label}        tone="neutral" sub={`${period.from} \u2192 ${period.to}`} />
        </div>

        {/* Account balance table */}
        <Section title="Trial Balance" subtitle={`${accounts.length} accounts with journal activity in period`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-5 py-2 text-left font-semibold">Account #</th>
                  <th className="px-4 py-2 text-left font-semibold">Name</th>
                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                  <th className="px-4 py-2 text-right font-semibold">Debit</th>
                  <th className="px-4 py-2 text-right font-semibold">Credit</th>
                  <th className="px-5 py-2 text-right font-semibold">Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc: any) => {
                  const b = getBalance(acc);
                  const hasActivity = b.debit > 0 || b.credit > 0;
                  return (
                    <tr key={acc.id} className={`border-t border-gray-100 ${hasActivity ? '' : 'text-gray-400'}`}>
                      <td className="px-5 py-2 font-mono tabular-nums text-xs text-gray-600">{acc.number}</td>
                      <td className="px-4 py-2 font-medium text-gray-900">{acc.name}</td>
                      <td className="px-4 py-2 text-xs capitalize text-gray-500">{acc.account_type?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">{b.debit > 0 ? money(b.debit) : ''}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">{b.credit > 0 ? money(b.credit) : ''}</td>
                      <td className={`px-5 py-2 text-right tabular-nums font-medium ${b.net >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {hasActivity ? money(Math.abs(b.net)) : ''}
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-5 py-2" colSpan={3}>Totals</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900">{money(totalDebit)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-900">{money(totalCredit)}</td>
                  <td className="px-5 py-2 text-right tabular-nums text-gray-900">
                    {money(Math.abs(totalDebit - totalCredit))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </Workspace>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. BALANCE SHEET
// ═══════════════════════════════════════════════════════════════
async function BalanceSheetView({
  def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope,
}: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;

  // Fetch active GL accounts
  const { data: glAccounts } = await db
    .from('gl_accounts')
    .select('id, number, name, account_type, active')
    .eq('active', true)
    .order('number');

  const accounts = (glAccounts ?? []) as any[];

  // Fetch all journal_lines up to period.to (As Of date)
  let lineQuery = db
    .from('journal_lines')
    .select('id, debit_amount, credit_amount, gl_account_id, entry_id, journal_entries!inner(entry_date, posted)')
    .eq('journal_entries.posted', true)
    .lte('journal_entries.entry_date', period.to);

  if (selectedAssociation) {
    lineQuery = lineQuery.eq('association_id', selectedAssociation);
  }

  const { data: lines } = await lineQuery;
  const journalLines = (lines ?? []) as any[];

  // Aggregate
  const totals: Record<string, { debit: number; credit: number }> = {};
  for (const line of journalLines) {
    const accId = line.gl_account_id;
    if (!totals[accId]) totals[accId] = { debit: 0, credit: 0 };
    totals[accId].debit  += Number(line.debit_amount ?? 0);
    totals[accId].credit += Number(line.credit_amount ?? 0);
  }

  const getNetBalance = (accId: string, accountType: string) => {
    const t = totals[accId] ?? { debit: 0, credit: 0 };
    // Asset/Expense: debit positive; Liability/Equity/Income: credit positive
    const assetLike = ['asset', 'cash', 'expense', 'cost_of_goods_sold', 'accounts_receivable', 'fixed_asset'];
    if (assetLike.includes(accountType ?? '')) {
      return t.debit - t.credit;
    }
    return t.credit - t.debit;
  };

  const classify = (acc: any) => {
    const n = acc.number;
    if (n < 2000) return 'Assets';
    if (n < 3000) return 'Liabilities';
    if (n < 4000) return 'Equity';
    return null; // non-balance-sheet
  };

  const assets      = accounts.filter((a) => classify(a) === 'Assets');
  const liabilities = accounts.filter((a) => classify(a) === 'Liabilities');
  const equity      = accounts.filter((a) => classify(a) === 'Equity');

  const sumBalance = (list: any[]) => list.reduce((s, a) => s + getNetBalance(a.id, a.account_type), 0);

  // Roll current-year net income (revenue − expenses, cumulative through the as-of
  // date) into equity as retained earnings — otherwise the sheet doesn't balance.
  const isIncome  = (t: string) => ['income', 'other_income'].includes(t ?? '');
  const isExpense = (t: string) => ['expense', 'other_expense', 'cost_of_goods_sold'].includes(t ?? '');
  const netIncome =
    accounts.filter((a) => isIncome(a.account_type)).reduce((s, a) => s + getNetBalance(a.id, a.account_type), 0) -
    accounts.filter((a) => isExpense(a.account_type)).reduce((s, a) => s + getNetBalance(a.id, a.account_type), 0);
  totals['__ni__'] = { debit: netIncome < 0 ? -netIncome : 0, credit: netIncome > 0 ? netIncome : 0 };
  const equityDisplay = [...equity, { id: '__ni__', number: 3650, name: 'Current Year Net Income', account_type: 'equity' }];

  const totalAssets      = sumBalance(assets);
  const totalLiabilities = sumBalance(liabilities);
  const totalEquity      = sumBalance(equityDisplay);
  const totalLE          = totalLiabilities + totalEquity;

  const renderSection = (title: string, items: any[], total: number) => (
    <Section key={title} title={title} subtitle={`${items.length} accounts`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
            <tr>
              <th className="px-5 py-2 text-left font-semibold">Account</th>
              <th className="px-5 py-2 text-right font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a: any) => {
              const bal = getNetBalance(a.id, a.account_type);
              return (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-5 py-2">
                    <span className="font-mono text-xs text-gray-500 mr-2">{a.number}</span>
                    <span className="font-medium text-gray-900">{a.name}</span>
                  </td>
                  <td className={`px-5 py-2 text-right tabular-nums font-medium ${bal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {money(bal)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
              <td className="px-5 py-2">Total {title}</td>
              <td className={`px-5 py-2 text-right tabular-nums ${total >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {money(total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  );

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/reports" className="transition-colors hover:text-gray-700">Reports</Link>
              {' \u00B7 '}
              <span className="text-gray-400">{CATEGORY_LABELS[def.category] ?? def.category}</span>
              {' \u00B7 '}
              <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold uppercase text-green-700">live</span>
            </>
          }
          title={def.name}
          subtitle={`As of ${date(period.to)}`}
        />
      }
      rail={<ReportRightRail def={def} runs={runs} associations={associations} period={period}
        selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} selectedScope={selectedScope} isLive />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Total Assets"      value={money(totalAssets)}      tone="neutral" />
          <Tile label="Total Liabilities" value={money(totalLiabilities)} tone="warning" />
          <Tile label="Total Equity"      value={money(totalEquity)}      tone="positive" />
        </div>

        {renderSection('Assets', assets, totalAssets)}
        {renderSection('Liabilities', liabilities, totalLiabilities)}
        {renderSection('Equity', equityDisplay, totalEquity)}

        <Section title="Balance Check">
          <div className="px-5 py-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center"><div className="text-xs text-gray-500">Assets</div><div className="font-semibold text-gray-900">{money(totalAssets)}</div></div>
              <div className="text-center"><div className="text-xs text-gray-500">Liabilities + Equity</div><div className="font-semibold text-gray-900">{money(totalLE)}</div></div>
              <div className="text-center"><div className="text-xs text-gray-500">Difference</div>
                <div className={`font-semibold ${Math.abs(totalAssets - totalLE) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
                  {Math.abs(totalAssets - totalLE) < 0.01 ? '\u2714 Balanced' : money(totalAssets - totalLE)}
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>
    </Workspace>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. INCOME STATEMENT
// ═══════════════════════════════════════════════════════════════
async function IncomeStatementView({
  def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope,
}: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;

  // Fetch income (4000-4999, 7000-7999) and expense (5000-6999, 8000-9999) accounts
  const { data: glAccounts } = await db
    .from('gl_accounts')
    .select('id, number, name, account_type, active')
    .eq('active', true)
    .order('number');

  const allAccounts = (glAccounts ?? []) as any[];

  // Fetch journal lines for the period
  let lineQuery = db
    .from('journal_lines')
    .select('id, debit_amount, credit_amount, gl_account_id, entry_id, journal_entries!inner(entry_date, posted)')
    .eq('journal_entries.posted', true)
    .gte('journal_entries.entry_date', period.from)
    .lte('journal_entries.entry_date', period.to);

  if (selectedAssociation) {
    lineQuery = lineQuery.eq('association_id', selectedAssociation);
  }

  const { data: lines } = await lineQuery;
  const journalLines = (lines ?? []) as any[];

  const totals: Record<string, { debit: number; credit: number }> = {};
  for (const line of journalLines) {
    const accId = line.gl_account_id;
    if (!totals[accId]) totals[accId] = { debit: 0, credit: 0 };
    totals[accId].debit  += Number(line.debit_amount ?? 0);
    totals[accId].credit += Number(line.credit_amount ?? 0);
  }

  // For income: net = credit - debit (revenue goes to credit)
  // For expense: net = debit - credit (expense goes to debit)
  const getISBalance = (acc: any) => {
    const t = totals[acc.id] ?? { debit: 0, credit: 0 };
    const type = acc.account_type ?? '';
    if (type === 'income' || type === 'other_income') {
      return t.credit - t.debit; // revenue: credit positive
    }
    return t.debit - t.credit; // expense: debit positive
  };

  const classifyIS = (acc: any) => {
    const n = acc.number;
    if (n >= 4000 && n < 5000) return 'Operating Revenue';
    if (n >= 7000 && n < 8000) return 'Other Revenue';
    if (n >= 5000 && n < 6000) return 'Cost of Goods Sold';
    if (n >= 6000 && n < 7000) return 'Operating Expenses';
    if (n >= 8000 && n < 9000) return 'Other Expenses';
    if (n >= 9000 && n < 10000) return 'Non-Operating';
    return null;
  };

  const incomeAccounts = allAccounts.filter((a) => classifyIS(a) && a.number < 5000 || (a.number >= 7000 && a.number < 8000));
  const expenseAccounts = allAccounts.filter((a) => classifyIS(a) && a.number >= 5000 && a.number < 7000 || (a.number >= 8000));

  // Detailed classification
  const revenueSections = [
    { label: 'Operating Revenue', items: allAccounts.filter((a) => a.number >= 4000 && a.number < 5000) },
    { label: 'Other Revenue',     items: allAccounts.filter((a) => a.number >= 7000 && a.number < 8000) },
  ];

  const expenseSections = [
    { label: 'Cost of Goods Sold',  items: allAccounts.filter((a) => a.number >= 5000 && a.number < 6000) },
    { label: 'Operating Expenses',  items: allAccounts.filter((a) => a.number >= 6000 && a.number < 7000) },
    { label: 'Other Expenses',      items: allAccounts.filter((a) => a.number >= 8000 && a.number < 9000) },
    { label: 'Non-Operating',       items: allAccounts.filter((a) => a.number >= 9000 && a.number < 10000) },
  ];

  const totalRevenue  = allAccounts.reduce((s, a) => s + (classifyIS(a) && (a.number < 5000 || (a.number >= 7000 && a.number < 8000)) ? getISBalance(a) : 0), 0);
  const totalExpenses = allAccounts.reduce((s, a) => s + (classifyIS(a) && (a.number >= 5000 && a.number < 7000 || a.number >= 8000) ? Math.abs(getISBalance(a)) : 0), 0);
  const netIncome = totalRevenue - totalExpenses;

  const renderISSection = (label: string, items: any[], showValues = true) => {
    const total = items.reduce((s, a) => s + getISBalance(a), 0);
    const absTotal = items.reduce((s, a) => s + Math.abs(getISBalance(a)), 0);
    return (
      <Section key={label} title={label} subtitle={`${items.length} accounts`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Account</th>
                <th className="px-5 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a: any) => {
                const bal = getISBalance(a);
                if (bal === 0 && !showValues) return null;
                return (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="px-5 py-2">
                      <span className="font-mono text-xs text-gray-500 mr-2">{a.number}</span>
                      <span className="font-medium text-gray-900">{a.name}</span>
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums font-medium text-gray-900">
                      {money(Math.abs(bal))}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td className="px-5 py-2">Total {label}</td>
                <td className="px-5 py-2 text-right tabular-nums text-gray-900">
                  {money(absTotal > 0 ? absTotal : Math.abs(total))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    );
  };

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/reports" className="transition-colors hover:text-gray-700">Reports</Link>
              {' \u00B7 '}
              <span className="text-gray-400">{CATEGORY_LABELS[def.category] ?? def.category}</span>
              {' \u00B7 '}
              <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold uppercase text-green-700">live</span>
            </>
          }
          title={def.name}
          subtitle={`${period.from} \u2192 ${period.to}`}
        />
      }
      rail={<ReportRightRail def={def} runs={runs} associations={associations} period={period}
        selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} selectedScope={selectedScope} isLive />}
    >
      <div className="space-y-4">
        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-3">
          <Tile label="Total Revenue"      value={money(totalRevenue)}  tone="positive" />
          <Tile label="Total Expenses"     value={money(totalExpenses)} tone="danger" />
          <Tile label="Net Income (NOI)"   value={money(netIncome)}     tone={netIncome >= 0 ? 'positive' : 'danger'} />
          <Tile label="Period"             value={period.label}         tone="neutral" sub={`${period.from} \u2192 ${period.to}`} />
        </div>

        {revenueSections.map((s) => renderISSection(s.label, s.items))}
        {expenseSections.map((s) => renderISSection(s.label, s.items))}

        {/* Net Income summary */}
        <Section title="Net Operating Income">
          <div className="px-5 py-4">
            <div className="flex items-center justify-between text-sm">
              <div>
                <div className="text-xs text-gray-500">Total Revenue - Total Expenses</div>
              </div>
              <div className={`text-lg font-bold tabular-nums ${netIncome >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {money(netIncome)}
              </div>
            </div>
          </div>
        </Section>
      </div>
    </Workspace>
  );
}

// ═══════════════════════════════════════════════════════════════
// 4. CASH FLOW
// ═══════════════════════════════════════════════════════════════
async function CashFlowView({
  def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope,
}: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;

  // Bank accounts (no stored balance column — balances are derived from GL lines below)
  const { data: bankAccounts } = await db
    .from('bank_accounts')
    .select('id, name, bank_name, account_type, gl_account_id')
    .is('archived_at', null)
    .order('name');
  const bAccounts = (bankAccounts ?? []) as any[];

  // Fetch bank transfers in period
  let transferQuery = db
    .from('bank_transfers')
    .select('id, amount, transfer_date, reference_number, memo, journal_entry_id, from_bank_account_id, to_bank_account_id')
    .gte('transfer_date', period.from)
    .lte('transfer_date', period.to)
    .order('transfer_date', { ascending: false });

  const { data: transfers } = await transferQuery;
  const bankTransfers = (transfers ?? []) as any[];

  // Cash journal lines in period
  let cashLineQuery = db
    .from('journal_lines')
    .select('id, debit_amount, credit_amount, gl_account_id, association_id, journal_entries!inner(entry_date, posted, memo, description)')
    .eq('journal_entries.posted', true)
    .gte('journal_entries.entry_date', period.from)
    .lte('journal_entries.entry_date', period.to);

  if (selectedAssociation) {
    cashLineQuery = cashLineQuery.eq('association_id', selectedAssociation);
  }

  const { data: cashLines } = await cashLineQuery;
  const cashJournalLines = (cashLines ?? []) as any[];

  // TRUE cash accounts only (account_type = 'cash' — not the whole 1000–1999 range,
  // which also contains A/R and prepaids).
  const { data: cashAccounts } = await db
    .from('gl_accounts')
    .select('id, number, name')
    .eq('account_type', 'cash')
    .eq('active', true);

  const cashAccountIds = new Set(((cashAccounts ?? []) as any[]).map((a: any) => a.id));
  const cashActivity = cashJournalLines.filter((l: any) => cashAccountIds.has(l.gl_account_id));

  // A debit to a cash account increases cash (inflow); a credit decreases it (outflow).
  const operatingInflows  = cashActivity.reduce((s: number, l: any) => s + Number(l.debit_amount ?? 0), 0);
  const operatingOutflows = cashActivity.reduce((s: number, l: any) => s + Number(l.credit_amount ?? 0), 0);
  const netCashFlow = operatingInflows - operatingOutflows;

  // Ending balance per bank account = net of its GL account's posted lines through the as-of date.
  const bankGlIds = bAccounts.map((a: any) => a.gl_account_id).filter(Boolean);
  const balByGl: Record<string, number> = {};
  if (bankGlIds.length > 0) {
    let balQuery = db
      .from('journal_lines')
      .select('gl_account_id, debit_amount, credit_amount, journal_entries!inner(posted, entry_date)')
      .in('gl_account_id', bankGlIds)
      .eq('journal_entries.posted', true)
      .lte('journal_entries.entry_date', period.to);
    if (selectedAssociation) balQuery = balQuery.eq('association_id', selectedAssociation);
    const { data: balLines } = await balQuery;
    for (const l of (balLines ?? []) as any[]) {
      balByGl[l.gl_account_id] = (balByGl[l.gl_account_id] ?? 0) + Number(l.debit_amount ?? 0) - Number(l.credit_amount ?? 0);
    }
  }

  // Transfer totals
  const totalTransfers = bankTransfers.reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0);
  const completedTransfers = bankTransfers.filter((t: any) => t.journal_entry_id).length;

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/reports" className="transition-colors hover:text-gray-700">Reports</Link>
              {' \u00B7 '}
              <span className="text-gray-400">{CATEGORY_LABELS[def.category] ?? def.category}</span>
              {' \u00B7 '}
              <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold uppercase text-green-700">live</span>
            </>
          }
          title={def.name}
          subtitle={`${period.from} \u2192 ${period.to}`}
        />
      }
      rail={<ReportRightRail def={def} runs={runs} associations={associations} period={period}
        selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} selectedScope={selectedScope} isLive />}
    >
      <div className="space-y-4">
        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-3">
          <Tile label="Operating Inflows"  value={money(operatingInflows)}  tone="positive" sub="Cash received" />
          <Tile label="Operating Outflows" value={money(operatingOutflows)} tone="danger"  sub="Cash paid out" />
          <Tile label="Net Cash Flow"      value={money(netCashFlow)}       tone={netCashFlow >= 0 ? 'positive' : 'danger'} />
          <Tile label="Period"             value={period.label}             tone="neutral" sub={`${period.from} \u2192 ${period.to}`} />
        </div>

        {/* Bank account balances */}
        <Section title="Bank Account Balances" subtitle={`${bAccounts.length} accounts`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-5 py-2 text-left font-semibold">Account</th>
                  <th className="px-4 py-2 text-left font-semibold">Bank</th>
                  <th className="px-4 py-2 text-left font-semibold">Type</th>
                  <th className="px-5 py-2 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {bAccounts.map((a: any) => (
                  <tr key={a.id} className="border-t border-gray-100">
                    <td className="px-5 py-2 font-medium text-gray-900">{a.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{a.bank_name ?? '\u2014'}</td>
                    <td className="px-4 py-2 text-xs capitalize text-gray-500">{a.account_type?.replace(/_/g, ' ') ?? '\u2014'}</td>
                    <td className={`px-5 py-2 text-right tabular-nums font-medium ${(balByGl[a.gl_account_id] ?? 0) >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                      {money(balByGl[a.gl_account_id] ?? 0)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                  <td className="px-5 py-2" colSpan={3}>Total Cash</td>
                  <td className="px-5 py-2 text-right tabular-nums text-gray-900">
                    {money(bAccounts.reduce((s: number, a: any) => s + (balByGl[a.gl_account_id] ?? 0), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* Bank transfers */}
        <Section title="Bank Transfers" subtitle={`${bankTransfers.length} transfers in period`}>
          {bankTransfers.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500">No bank transfers in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-5 py-2 text-left font-semibold">Date</th>
                    <th className="px-4 py-2 text-left font-semibold">Reference</th>
                    <th className="px-4 py-2 text-left font-semibold">Memo</th>
                    <th className="px-4 py-2 text-right font-semibold">Amount</th>
                    <th className="px-5 py-2 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bankTransfers.slice(0, 100).map((t: any) => (
                    <tr key={t.id} className="border-t border-gray-100">
                      <td className="whitespace-nowrap px-5 py-2 text-xs text-gray-600">{date(t.transfer_date)}</td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">{t.reference_number ?? '\u2014'}</td>
                      <td className="max-w-xs truncate px-4 py-2 text-sm text-gray-600">{t.memo ?? '\u2014'}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900">{money(t.amount)}</td>
                      <td className="px-5 py-2 text-center">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium ${t.journal_entry_id ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                          {t.journal_entry_id ? 'Posted' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Cash Flow Summary */}
        <Section title="Cash Flow Summary">
          <div className="px-5 py-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Operating inflows (debits to cash)</span>
              <span className="tabular-nums font-medium text-green-700">{money(operatingInflows)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Operating outflows (credits to cash)</span>
              <span className="tabular-nums font-medium text-red-600">({money(operatingOutflows)})</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold">
              <span className="text-gray-900">Net cash from operations</span>
              <span className={`tabular-nums ${netCashFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>{money(netCashFlow)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Bank transfers in period</span>
              <span className="tabular-nums font-medium text-gray-700">{money(totalTransfers)}</span>
            </div>
          </div>
        </Section>
      </div>
    </Workspace>
  );
}

// ═══════════════════════════════════════════════════════════════
// 5. GENERAL LEDGER
// ═══════════════════════════════════════════════════════════════
async function GeneralLedgerView({
  def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope,
}: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;

  // Fetch all journal lines with entries for the period, grouped by GL account
  const { data: glAccounts } = await db
    .from('gl_accounts')
    .select('id, number, name, account_type')
    .eq('active', true)
    .order('number');

  const accounts = (glAccounts ?? []) as any[];

  // Fetch journal_lines with entry info
  let lineQuery = db
    .from('journal_lines')
    .select(`id, debit_amount, credit_amount, memo, gl_account_id, entry_id,
      journal_entries!inner(id, entry_date, description, memo, reference_number, posted)`)
    .eq('journal_entries.posted', true)
    .gte('journal_entries.entry_date', period.from)
    .lte('journal_entries.entry_date', period.to)
    .order('sort_order');

  if (selectedAssociation) {
    lineQuery = lineQuery.eq('association_id', selectedAssociation);
  }

  const { data: lines } = await lineQuery;
  const journalLines = (lines ?? []) as any[];

  // Group lines by gl_account_id
  const grouped = new Map<string, any[]>();
  for (const line of journalLines) {
    const accId = line.gl_account_id;
    if (!grouped.has(accId)) grouped.set(accId, []);
    grouped.get(accId)!.push(line);
  }

  // Build account map
  const accountMap = new Map<string, any>();
  for (const acc of accounts) accountMap.set(acc.id, acc);

  // Only show accounts that have activity
  const activeAccountIds = new Set(grouped.keys());
  const activeAccounts = accounts.filter((a) => activeAccountIds.has(a.id));

  const totalDebit  = journalLines.reduce((s, l) => s + Number(l.debit_amount ?? 0), 0);
  const totalCredit = journalLines.reduce((s, l) => s + Number(l.credit_amount ?? 0), 0);
  const totalEntries = new Set(journalLines.map((l: any) => l.entry_id)).size;

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/reports" className="transition-colors hover:text-gray-700">Reports</Link>
              {' \u00B7 '}
              <span className="text-gray-400">{CATEGORY_LABELS[def.category] ?? def.category}</span>
              {' \u00B7 '}
              <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold uppercase text-green-700">live</span>
            </>
          }
          title={def.name}
          subtitle={`${period.from} \u2192 ${period.to}`}
        />
      }
      rail={<ReportRightRail def={def} runs={runs} associations={associations} period={period}
        selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} selectedScope={selectedScope} isLive />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <Tile label="Total Debits"    value={money(totalDebit)}    tone="neutral" />
          <Tile label="Total Credits"   value={money(totalCredit)}   tone="neutral" />
          <Tile label="Journal Entries" value={totalEntries}         tone="neutral" sub="Posted entries" />
          <Tile label="Line Items"      value={journalLines.length}  tone="neutral" />
        </div>

        {activeAccounts.length === 0 ? (
          <Section title="General Ledger">
            <p className="px-5 py-8 text-center text-sm text-gray-500">
              No journal activity found in this period. Try selecting a different date range.
            </p>
          </Section>
        ) : (
          activeAccounts.map((acc: any) => {
            const lines = grouped.get(acc.id) ?? [];
            const sumDebit  = lines.reduce((s, l) => s + Number(l.debit_amount ?? 0), 0);
            const sumCredit = lines.reduce((s, l) => s + Number(l.credit_amount ?? 0), 0);
            return (
              <Section
                key={acc.id}
                title={`${acc.number} \u2014 ${acc.name}`}
                subtitle={`${lines.length} line${lines.length !== 1 ? 's' : ''} \u00B7 Debits: ${money(sumDebit)} \u00B7 Credits: ${money(sumCredit)}`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                      <tr>
                        <th className="px-5 py-2 text-left font-semibold w-28">Date</th>
                        <th className="px-4 py-2 text-left font-semibold">Description</th>
                        <th className="px-4 py-2 text-left font-semibold">Reference</th>
                        <th className="px-4 py-2 text-right font-semibold">Debit</th>
                        <th className="px-4 py-2 text-right font-semibold">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l: any) => {
                        const entry = l.journal_entries;
                        return (
                          <tr key={l.id} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="whitespace-nowrap px-5 py-2 text-xs text-gray-600">{date(entry?.entry_date)}</td>
                            <td className="max-w-md px-4 py-2">
                              <div className="text-gray-900">{entry?.description ?? l.memo ?? '\u2014'}</div>
                              {entry?.memo && <div className="text-xs text-gray-500">{entry.memo}</div>}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-gray-500">{entry?.reference_number ?? '\u2014'}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-gray-700">{l.debit_amount > 0 ? money(l.debit_amount) : ''}</td>
                            <td className="px-4 py-2 text-right tabular-nums text-gray-700">{l.credit_amount > 0 ? money(l.credit_amount) : ''}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-xs">
                        <td className="px-5 py-2" colSpan={3}>Account Total</td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-900">{money(sumDebit)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-900">{money(sumCredit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Section>
            );
          })
        )}
      </div>
    </Workspace>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXISTING: A/R AGING LIVE VIEW
// ═══════════════════════════════════════════════════════════════
async function ARAgingView({
  def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope,
}: ReportContext) {
  const supabase = await createClient();

  let q = (supabase as any).from('aged_receivables').select('*').order('due_date');
  if (selectedAssociation) q = q.eq('association_id', selectedAssociation);
  const { data: rows } = await q;
  const assocs = associations;

  // aged_receivables emits underscore bucket keys: current, 1_30, 31_60, 61_90, 90_plus
  const BUCKETS = ['current', '1_30', '31_60', '61_90', '90_plus'];
  const BUCKET_LABEL: Record<string, string> = {
    current: 'Current', '1_30': '1-30 days', '31_60': '31-60 days', '61_90': '61-90 days', '90_plus': '90+ days',
  };
  const totals: Record<string, { count: number; amount: number }> = {};
  for (const b of BUCKETS) totals[b] = { count: 0, amount: 0 };
  for (const r of (rows ?? []) as any[]) {
    const b = r.aging_bucket in totals ? r.aging_bucket : '90_plus';
    totals[b].count += 1;
    totals[b].amount += Number(r.balance_due ?? 0);
  }
  const grand = Object.values(totals).reduce((s, v) => s + v.amount, 0);
  const pastDue = totals['31_60'].amount + totals['61_90'].amount + totals['90_plus'].amount;
  const distinctUnits = new Set((rows ?? []).map((r: any) => r.unit_id)).size;

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/reports" className="transition-colors hover:text-gray-700">Reports</Link>
              {' \u00B7 '}
              <span className="text-gray-400">{CATEGORY_LABELS[def.category] ?? def.category}</span>
              {' \u00B7 '}
              <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold uppercase text-green-700">live</span>
            </>
          }
          title={def.name}
          subtitle={def.description}
        />
      }
      rail={<ReportRightRail def={def} runs={runs} associations={associations} period={period} selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} selectedScope={selectedScope} isLive />}
    >
      <div className="grid grid-cols-5 gap-3">
        {BUCKETS.map((b) => (
          <Tile
            key={b}
            label={BUCKET_LABEL[b]}
            value={money(totals[b].amount)}
            sub={`${totals[b].count} ${totals[b].count === 1 ? 'charge' : 'charges'}`}
            tone={b === 'current' ? 'positive' : totals[b].amount > 0 ? (b === '90_plus' ? 'danger' : 'warning') : 'neutral'}
          />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-4 gap-3">
        <Tile label="Total outstanding" value={money(grand)}     tone={grand > 0 ? 'danger' : 'positive'} />
        <Tile label="Past due (30d+)"    value={money(pastDue)}   tone={pastDue > 0 ? 'danger' : 'positive'} />
        <Tile label="Units with balance" value={distinctUnits} />
        <Tile label="Open charges"       value={(rows ?? []).length} />
      </div>

      <Section
        title="Open charges"
        subtitle="Every receivable with a positive balance"
        actions={
          <select
            className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            defaultValue=""
          >
            <option value="">All associations</option>
            {(assocs ?? []).map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        }
      >
        {(rows ?? []).length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">No open receivables. All units paid up.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-5 py-2 text-left font-semibold">Unit</th>
                  <th className="px-4 py-2 text-left font-semibold">Description</th>
                  <th className="px-4 py-2 text-left font-semibold">Due</th>
                  <th className="px-4 py-2 text-left font-semibold">Bucket</th>
                  <th className="px-4 py-2 text-right font-semibold">Charged</th>
                  <th className="px-4 py-2 text-right font-semibold">Paid</th>
                  <th className="px-5 py-2 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((r: any) => (
                  <tr key={r.charge_id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-2">
                      <div className="font-medium text-gray-900">Unit {r.unit_number}</div>
                      <div className="text-xs text-gray-500">{r.association_name}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-700">{r.description}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{date(r.due_date)}</td>
                    <td className="px-4 py-2"><BucketPill bucket={r.aging_bucket} /></td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{money(r.amount)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-500">{money(r.total_paid)}</td>
                    <td className="px-5 py-2 text-right font-semibold tabular-nums text-gray-900">{money(r.balance_due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </Workspace>
  );
}

function BucketPill({ bucket }: { bucket: string }) {
  const m: Record<string, string> = {
    current:   'bg-green-100 text-green-700',
    '1_30':    'bg-yellow-100 text-yellow-800',
    '31_60':   'bg-orange-100 text-orange-800',
    '61_90':   'bg-red-100 text-red-800',
    '90_plus': 'bg-red-200 text-red-900',
  };
  const label: Record<string, string> = {
    current: 'current', '1_30': '1-30d', '31_60': '31-60d', '61_90': '61-90d', '90_plus': '90+d',
  };
  const cls = m[bucket] ?? m['90_plus'];
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{label[bucket] ?? bucket}</span>;
}

// ═══════════════════════════════════════════════════════════════
// QUEUED REPORT VIEW — Run form + recent runs for this definition
// ═══════════════════════════════════════════════════════════════
function QueuedReportView(ctx: ReportContext) {
  const { def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope } = ctx;

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/reports" className="transition-colors hover:text-gray-700">Reports</Link>
              {' \u00B7 '}
              <span className="text-gray-400">{CATEGORY_LABELS[def.category] ?? def.category}</span>
            </>
          }
          title={def.name}
          subtitle={def.description}
        />
      }
      rail={<ReportRightRail def={def} runs={runs} associations={associations} period={period} selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} selectedScope={selectedScope} />}
    >
      <Section title="About this report">
        <div className="px-5 py-4 text-sm leading-6 text-gray-700">
          <p>{def.description}</p>
          <p className="mt-3 text-xs text-gray-500">
            Available formats:
            <span className="ml-2 inline-flex gap-1">
              {(def.output_formats ?? []).map((f: string) => (
                <span key={f} className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] uppercase text-gray-700">{f}</span>
              ))}
            </span>
          </p>
        </div>
      </Section>

      <Section title="Recent runs" subtitle={`Last ${runs.length} for this report`}>
        {runs.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-500">
            No runs yet. Use the panel on the right to run this report.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Created</th>
                <th className="px-4 py-2 text-left font-semibold">Format</th>
                <th className="px-4 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">Rows</th>
                <th className="px-5 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r: any) => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-2 text-gray-700">{date(r.created_at)}</td>
                  <td className="px-4 py-2 text-xs uppercase text-gray-500">{r.output_format}</td>
                  <td className="px-4 py-2"><RunPill status={r.status} /></td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-700">{r.row_count?.toLocaleString() ?? '\u2014'}</td>
                  <td className="px-5 py-2 text-right">
                    <Link href={`/reports/runs/${r.id}`} className="text-xs font-medium text-gray-600 transition-colors hover:text-gray-950">
                      {r.status === 'succeeded' ? 'Download' : 'Open'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </Workspace>
  );
}

// ═══════════════════════════════════════════════════════════════
// RIGHT RAIL — Run form + quick stats
// ═══════════════════════════════════════════════════════════════
function ReportRightRail({
  def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope, isLive,
}: {
  def: any; runs: any[]; associations: any[]; period: Period;
  selectedAssociation: string; selectedPreset: string; selectedScope: string; isLive?: boolean;
}) {
  const lastSuccess = runs.find((r: any) => r.status === 'succeeded');
  const inFlight = runs.find((r: any) => r.status === 'queued' || r.status === 'running');

  const presets: Array<{ k: string; label: string }> = [
    { k: 'this_month',   label: 'This month' },
    { k: 'last_month',   label: 'Last month' },
    { k: 'this_quarter', label: 'This quarter' },
    { k: 'last_quarter', label: 'Last quarter' },
    { k: 'ytd',          label: 'Year to date' },
    { k: 'last_year',    label: 'Last year' },
    { k: 'custom',       label: 'Custom' },
  ];

  const presetHref = (k: string) => {
    const p = new URLSearchParams();
    p.set('preset', k);
    p.set('scope', selectedScope);
    if (selectedAssociation) p.set('association', selectedAssociation);
    return `?${p.toString()}`;
  };

  return (
    <>
      <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {isLive ? 'Export snapshot' : 'Run this report'}
      </div>

      <form action={queueReport as any} className="space-y-3">
        <input type="hidden" name="definition_id" value={def.id} />

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Scope</label>
          <select
            name="param_scope"
            defaultValue={selectedScope}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="portfolio">Portfolio</option>
            <option value="association">Association</option>
            <option value="owner">Owner</option>
            <option value="unit">Unit</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Association</label>
          <select
            name="param_association_id"
            defaultValue={selectedAssociation}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Select...</option>
            {associations.map((a: any) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-0.5 block text-[11px] text-gray-500">Owner ID</label>
            <input
              name="param_owner_id"
              placeholder="Optional"
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[11px] text-gray-500">Unit ID</label>
            <input
              name="param_unit_id"
              placeholder="Optional"
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Period presets */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Period</label>
          <div className="mb-2 flex flex-wrap gap-1">
            {presets.map((p) => (
              <Link
                key={p.k}
                href={presetHref(p.k)}
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  selectedPreset === p.k
                    ? 'border-gray-950 bg-gray-950 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[11px] text-gray-500">From</label>
              <input
                type="date"
                name="param_date_from"
                defaultValue={period.from}
                className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] text-gray-500">To</label>
              <input
                type="date"
                name="param_date_to"
                defaultValue={period.to}
                className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            {period.label}: {period.from} &rarr; {period.to}
          </p>
        </div>

        {/* Format */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Output format</label>
          <select
            name="output_format"
            defaultValue={def.output_formats?.[0] ?? 'csv'}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            {(def.output_formats ?? ['csv']).map((f: string) => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <Button type="submit" className="w-full">
          {isLive ? 'Export to file' : 'Run now'}
        </Button>
      </form>

      {inFlight && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          A run is currently <strong>{inFlight.status}</strong>.
          <Link href={`/reports/runs/${inFlight.id}`} className="ml-1 font-semibold hover:underline">View &rarr;</Link>
        </div>
      )}

      {lastSuccess && (
        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Latest output</div>
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 text-xs">
            <div className="font-mono uppercase text-gray-500">{lastSuccess.output_format}</div>
            <div className="mt-1 text-gray-700">{date(lastSuccess.created_at)}</div>
            <div className="mt-1 tabular-nums text-gray-700">{lastSuccess.row_count?.toLocaleString()} rows</div>
            {lastSuccess.output_url && (
              <a href={lastSuccess.output_url} target="_blank" rel="noopener"
                className="mt-2 inline-block font-medium text-gray-600 transition-colors hover:text-gray-950">
                Download &rarr;
              </a>
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Recent runs</div>
        {runs.length === 0 ? (
          <p className="text-xs text-gray-500">No runs yet.</p>
        ) : (
          <ul className="space-y-1">
            {runs.slice(0, 5).map((r: any) => (
              <li key={r.id}>
                <Link href={`/reports/runs/${r.id}`}
                  className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-gray-100">
                  <span className="text-gray-600">{date(r.created_at)}</span>
                  <RunPill status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function RunPill({ status }: { status: string }) {
  const m: Record<string, string> = {
    queued:    'bg-gray-100 text-gray-600 ring-gray-500/15',
    running:   'bg-blue-50 text-blue-700 ring-blue-600/15',
    succeeded: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    failed:    'bg-red-50 text-red-700 ring-red-600/15',
    cancelled: 'bg-gray-100 text-gray-400 ring-gray-500/15 line-through',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ring-1 ring-inset ${m[status] ?? m.queued}`}>{status}</span>;
}

// ═══════════════════════════════════════════════════════════════
// PERIOD COMPUTATION
// ═══════════════════════════════════════════════════════════════
type Period = { from: string; to: string; label: string };

function computePeriod(preset: string, customFrom?: string, customTo?: string): Period {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const firstOfMonth = (y: number, m: number) => new Date(y, m, 1);
  const lastOfMonth  = (y: number, m: number) => new Date(y, m + 1, 0);

  if (preset === 'custom') {
    return {
      from:  customFrom ?? fmt(firstOfMonth(today.getFullYear(), today.getMonth())),
      to:    customTo   ?? fmt(today),
      label: 'Custom',
    };
  }
  if (preset === 'last_month') {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { from: fmt(firstOfMonth(d.getFullYear(), d.getMonth())), to: fmt(lastOfMonth(d.getFullYear(), d.getMonth())), label: 'Last month' };
  }
  if (preset === 'this_quarter') {
    const q = Math.floor(today.getMonth() / 3) * 3;
    return { from: fmt(firstOfMonth(today.getFullYear(), q)), to: fmt(today), label: 'This quarter' };
  }
  if (preset === 'last_quarter') {
    const q = Math.floor(today.getMonth() / 3) * 3 - 3;
    const y = q < 0 ? today.getFullYear() - 1 : today.getFullYear();
    const m = (q + 12) % 12;
    return { from: fmt(firstOfMonth(y, m)), to: fmt(lastOfMonth(y, m + 2)), label: 'Last quarter' };
  }
  if (preset === 'ytd') {
    return { from: fmt(new Date(today.getFullYear(), 0, 1)), to: fmt(today), label: 'Year to date' };
  }
  if (preset === 'last_year') {
    return { from: fmt(new Date(today.getFullYear() - 1, 0, 1)), to: fmt(new Date(today.getFullYear() - 1, 11, 31)), label: 'Last year' };
  }
  // default: this_month
  return { from: fmt(firstOfMonth(today.getFullYear(), today.getMonth())), to: fmt(today), label: 'This month' };
}
