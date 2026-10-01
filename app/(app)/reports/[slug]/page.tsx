import { glDebitBalances, journalLineTotals, ledgerTotalsByAccount } from '@/lib/finance/totals';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Workspace, WorkspaceHeader, Section, Tile } from '@/components/reports/workspace';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/shell';
import { displayTimeZone } from '@/lib/time/display-zone';
import { todayInZone, wallDateTimeToIso } from '@/lib/time/zoned';
import { queueReport } from '@/lib/rpcs/reports';
import { money, date } from '@/lib/utils';
import { supportedReportOutputFormats } from '@/lib/reports/output';
import { addLedgerLine, financialSection, netIncome as calculateNetIncome, normalBalance } from '@/lib/reports/financial';

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
  'owner_1099_summary',
  'owner_1099_detail',
  'owner_vehicle_info',
  'homeowner_vehicle_info',
  'vehicle_info',
  'loan_statement',
  'reserve_fund_analysis',
  'fund_balance_sheet',
  'trust_account_balance',
  'trust_account_detail',
  'management_fee_summary',
  'owner_prepaid',
] as const;

type LiveReportSlug = (typeof LIVE_REPORT_SLUGS)[number];

export default async function ReportView({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preset?: string; from?: string; to?: string; association?: string; scope?: string; account?: string; saved?: string }>;
}) {
  const { slug } = await params;
  // Preserve the legacy public alias while resolving the canonical catalog row.
  // Without this mapping the route was listed as live in code but returned 404.
  const REPORT_ALIASES: Record<string, string> = {
    homeowner_vehicle_info: 'owner_vehicle_info',
    homeowner_ledger: 'owner_ledger', // homeowner_ledger is inactive; owner_ledger is the live row
  };
  const catalogSlug = REPORT_ALIASES[slug] ?? slug;
  const sp = await searchParams;
  const supabase = await createClient();

  // Saved report link (/reports/{slug}?saved={id}): apply its stored
  // parameters, unless the URL already carries explicit filters.
  const hasFilters = ['preset', 'from', 'to', 'association', 'scope', 'account'].some((k) => (sp as any)[k]);
  if (sp.saved && UUID_RE.test(sp.saved) && !hasFilters) {
    const { data: saved } = await (supabase as any)
      .from('saved_reports')
      .select('parameters')
      .eq('id', sp.saved)
      .maybeSingle();
    const qs = savedParamsToSearch(saved?.parameters);
    if (qs.toString()) redirect(`/reports/${encodeURIComponent(slug)}?${qs.toString()}`);
  }

  const { data: def } = await (supabase as any)
    .from('report_definitions')
    .select('id, slug, name, category, description, output_formats')
    .eq('slug', catalogSlug)
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

  const period = computePeriod(sp.preset ?? 'ytd', sp.from, sp.to);

  const ctx = {
    def,
    runs: runs ?? [],
    associations: associations ?? [],
    period,
    selectedAssociation: sp.association ?? '',
    selectedPreset: sp.preset ?? 'ytd',
    selectedScope: sp.scope ?? 'association',
    selectedAccount: /^[0-9a-f-]{36}$/i.test(sp.account ?? '') ? sp.account! : '',
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRESETS = ['this_month', 'last_month', 'this_quarter', 'last_quarter', 'ytd', 'last_year', 'custom'];

/**
 * Map saved_reports.parameters (stored from the run form's param_* fields:
 * scope, association_id, date_from, date_to …) onto the search params this
 * page understands. Unknown keys and malformed values are dropped.
 */
function savedParamsToSearch(raw: unknown): URLSearchParams {
  const qs = new URLSearchParams();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return qs;
  const p = raw as Record<string, unknown>;
  const str = (...keys: string[]) => {
    for (const k of keys) if (typeof p[k] === 'string' && p[k]) return p[k] as string;
    return '';
  };
  const from = str('from', 'date_from');
  const to = str('to', 'date_to');
  const preset = str('preset');
  const association = str('association', 'association_id');
  const scope = str('scope');
  const account = str('account', 'gl_account_id');
  if (PRESETS.includes(preset)) qs.set('preset', preset);
  if (DATE_RE.test(from)) qs.set('from', from);
  if (DATE_RE.test(to)) qs.set('to', to);
  if ((qs.has('from') || qs.has('to')) && !qs.has('preset')) qs.set('preset', 'custom');
  if (UUID_RE.test(association)) qs.set('association', association);
  if (/^[a-z_]{1,40}$/.test(scope)) qs.set('scope', scope);
  if (UUID_RE.test(account)) qs.set('account', account);
  return qs;
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
    case 'owner_1099_summary': return <Owner1099View {...ctx} detail={false} />;
    case 'owner_1099_detail':  return <Owner1099View {...ctx} detail={true} />;
    case 'owner_vehicle_info':
    case 'homeowner_vehicle_info':
    case 'vehicle_info':      return <VehicleInfoView {...ctx} />;
    case 'loan_statement':    return <LoanStatementView {...ctx} />;
    case 'reserve_fund_analysis': return <ReserveFundView {...ctx} />;
    case 'fund_balance_sheet':
    case 'trust_account_balance': return <FundBalanceView {...ctx} trustOnly={ctx.slug === 'trust_account_balance'} />;
    case 'trust_account_detail':  return <TrustDetailView {...ctx} />;
    case 'management_fee_summary': return <ManagementFeeSummaryView {...ctx} />;
    case 'owner_prepaid':     return <OwnerPrepaidView {...ctx} />;
    default:                  return <QueuedReportView {...ctx} />;
  }
}

type ReportContext = {
  def: any; runs: any[]; associations: any[]; period: Period;
  selectedAssociation: string; selectedPreset: string; selectedScope: string;
  selectedAccount?: string;
};

/**
 * Drill-down: open the General Ledger filtered to one account for the same
 * association and period. Point-in-time reports (balance sheet) pass
 * `sinceInception` so the ledger shows every entry up to the as-of date.
 */
function glDrillHref(accountId: string, ctx: Pick<ReportContext, 'period' | 'selectedAssociation'>, sinceInception = false) {
  const qs = new URLSearchParams({
    preset: 'custom',
    from: sinceInception ? '1900-01-01' : ctx.period.from,
    to: ctx.period.to,
    account: accountId,
  });
  if (ctx.selectedAssociation) qs.set('association', ctx.selectedAssociation);
  return `/reports/general_ledger?${qs.toString()}`;
}

function DrillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} title="Open the ledger lines behind this amount" className="underline decoration-gray-300 decoration-dotted underline-offset-4 transition-colors hover:text-gray-950 hover:decoration-gray-500">
      {children}
    </Link>
  );
}

// ═══════════════════════════════════════════════════════════════
// 1. TRIAL BALANCE
// ═══════════════════════════════════════════════════════════════
async function TrialBalanceView({
  def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope,
}: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;

  // Fetch every GL account (inactive ones can still carry a balance; dropping
  // them made the trial balance not balance) with their journal line totals.
  let q = db
    .from('gl_accounts')
    .select('id, number, name, account_type, active')
    .order('number');
  if (selectedAssociation) q = q.or(`association_id.is.null,association_id.eq.${selectedAssociation}`);

  const { data: glAccounts } = await q;
  const allAccounts = (glAccounts ?? []) as any[];

  // A trial balance is an as-of report. Limiting it to period activity makes a
  // new month look empty even when every account has a real opening balance.
  // Summed in the database: fetching lines stopped at 1,000 rows and
  // silently truncated the statement.
  const totals = await ledgerTotalsByAccount(db, {
    associationIds: selectedAssociation ? [selectedAssociation] : null,
    to: period.to,
  });
  for (const acc of allAccounts) totals[acc.id] ??= { debit: 0, credit: 0 };
  // Hide inactive accounts only when they have no ledger activity.
  const accounts = allAccounts.filter((a) => a.active !== false || totals[a.id].debit !== 0 || totals[a.id].credit !== 0);

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
        selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} selectedScope={selectedScope} isLive supportsLiveExport />}
    >
      <div className="space-y-4">
        {/* Summary tiles */}
        <div className="grid grid-cols-4 gap-3">
          <Tile label="Total Debits"  value={money(totalDebit)}  tone="neutral" sub="Sum of all debit entries" />
          <Tile label="Total Credits" value={money(totalCredit)} tone="neutral" sub="Sum of all credit entries" />
          <Tile label="GL Accounts"   value={accounts.length}     tone="neutral" sub="Active accounts" />
          <Tile label="As of"         value={date(period.to)}     tone="neutral" sub={period.label} />
        </div>

        {/* Account balance table */}
        <Section title="Trial Balance" subtitle={`${accounts.length} accounts as of ${date(period.to)}`}>
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
                      <td className="px-4 py-2 font-medium text-gray-900">{hasActivity ? <DrillLink href={glDrillHref(acc.id, { period, selectedAssociation })}>{acc.name}</DrillLink> : acc.name}</td>
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

  // Fetch every GL account (an inactive account can still carry a balance)
  let glAccountQuery = db
    .from('gl_accounts')
    .select('id, number, name, account_type, active')
    .order('number');
  if (selectedAssociation) glAccountQuery = glAccountQuery.or(`association_id.is.null,association_id.eq.${selectedAssociation}`);
  const { data: glAccounts } = await glAccountQuery;

  // Posted totals through the as-of date, summed in the database (a list of
  // lines stopped at 1,000 rows).
  const totals = await ledgerTotalsByAccount(db, {
    associationIds: selectedAssociation ? [selectedAssociation] : null,
    to: period.to,
  });
  // Hide inactive accounts only when they have no ledger activity.
  const accounts = ((glAccounts ?? []) as any[]).filter((a) =>
    a.active !== false || (totals[a.id] && (totals[a.id].debit !== 0 || totals[a.id].credit !== 0)));

  // Chart-of-accounts type is authoritative. Account-number bands vary by
  // association and must never decide whether a balance is an asset or debt.
  const getNetBalance = (account: any) => normalBalance(account, totals);
  const assets      = accounts.filter((a) => financialSection(a) === 'asset');
  const liabilities = accounts.filter((a) => financialSection(a) === 'liability');
  const equity      = accounts.filter((a) => financialSection(a) === 'equity');

  const sumBalance = (list: any[]) => list.reduce((s, a) => s + getNetBalance(a), 0);

  // Roll current-year net income (revenue − expenses, cumulative through the as-of
  // date) into equity as retained earnings — otherwise the sheet doesn't balance.
  const currentYearStart = `${period.to.slice(0, 4)}-01-01`;
  const currentYearTotals = await ledgerTotalsByAccount(db, {
    associationIds: selectedAssociation ? [selectedAssociation] : null,
    from: currentYearStart,
    to: period.to,
  });
  const netIncome = calculateNetIncome(accounts, currentYearTotals);
  totals['__ni__'] = { debit: netIncome < 0 ? -netIncome : 0, credit: netIncome > 0 ? netIncome : 0 };
  // No closing entries are posted, so earlier years' income and expense never
  // reach an equity account: carry them as accumulated surplus or the sheet
  // stops balancing on January 1.
  const priorYearsSurplus = calculateNetIncome(accounts, totals) - netIncome;
  totals['__prior__'] = { debit: priorYearsSurplus < 0 ? -priorYearsSurplus : 0, credit: priorYearsSurplus > 0 ? priorYearsSurplus : 0 };
  const equityDisplay = [
    ...equity,
    ...(Math.abs(priorYearsSurplus) >= 0.005 ? [{ id: '__prior__', number: 3640, name: 'Accumulated Surplus – Prior Years', account_type: 'equity' }] : []),
    { id: '__ni__', number: 3650, name: 'Current Year Net Income', account_type: 'equity' },
  ];

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
              const bal = getNetBalance(a);
              return (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-5 py-2">
                    <span className="font-mono text-xs text-gray-500 mr-2">{a.number}</span>
                    <span className="font-medium text-gray-900"><DrillLink href={glDrillHref(a.id, { period, selectedAssociation }, true)}>{a.name}</DrillLink></span>
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
  let glAccountQuery = db
    .from('gl_accounts')
    .select('id, number, name, account_type, active')
    // All accounts (an inactive account can still have period activity);
    // idle inactive accounts are hidden once totals are known.
    .order('number');
  if (selectedAssociation) glAccountQuery = glAccountQuery.or(`association_id.is.null,association_id.eq.${selectedAssociation}`);
  const { data: glAccounts } = await glAccountQuery;

  // Period totals summed in the database (a list of lines stopped at 1,000 rows).
  const totals = await ledgerTotalsByAccount(db, {
    associationIds: selectedAssociation ? [selectedAssociation] : null,
    from: period.from,
    to: period.to,
  });
  // Hide inactive accounts only when they have no activity in the period.
  const allAccounts = ((glAccounts ?? []) as any[]).filter((a) =>
    a.active !== false || (totals[a.id] && (totals[a.id].debit !== 0 || totals[a.id].credit !== 0)));

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

  // Account type is authoritative. Associations may use custom account
  // numbers, so number bands must never decide whether activity is revenue
  // or expense.
  const incomeAccounts = allAccounts.filter(
    (account) => financialSection(account) === 'income',
  );
  const expenseAccounts = allAccounts.filter(
    (account) => financialSection(account) === 'expense',
  );

  const revenueSections = [
    { label: 'Revenue', items: incomeAccounts },
  ];
  const expenseSections = [
    { label: 'Expenses', items: expenseAccounts },
  ];

  const totalRevenue = incomeAccounts.reduce(
    (sum, account) => sum + getISBalance(account),
    0,
  );
  const totalExpenses = expenseAccounts.reduce(
    (sum, account) => sum + getISBalance(account),
    0,
  );
  const netIncome = totalRevenue - totalExpenses;

  const renderISSection = (label: string, items: any[], showValues = true) => {
    // Signed totals: a credit balance on an expense account (e.g. a vendor
    // credit) reduces expenses; summing absolute values overstated them.
    const total = items.reduce((s, a) => s + getISBalance(a), 0);
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
                      <span className="font-medium text-gray-900"><DrillLink href={glDrillHref(a.id, { period, selectedAssociation })}>{a.name}</DrillLink></span>
                    </td>
                    <td className={`px-5 py-2 text-right tabular-nums font-medium ${bal < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {bal < 0 ? `(${money(-bal)})` : money(bal)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td className="px-5 py-2">Total {label}</td>
                <td className={`px-5 py-2 text-right tabular-nums ${total < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {total < 0 ? `(${money(-total)})` : money(total)}
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
  let bankQuery = db
    .from('bank_accounts')
    .select('id, name, bank_name, account_type, gl_account_id')
    .is('archived_at', null)
    .order('name');
  if (selectedAssociation) bankQuery = bankQuery.eq('association_id', selectedAssociation);
  const { data: bankAccounts } = await bankQuery;
  const bAccounts = (bankAccounts ?? []) as any[];

  // Fetch bank transfers in period. bank_transfers has no association_id, so
  // scope to transfers touching one of the association's bank accounts.
  let transferQuery = db
    .from('bank_transfers')
    .select('id, amount, transfer_date, reference_number, memo, journal_entry_id, from_bank_account_id, to_bank_account_id')
    .gte('transfer_date', period.from)
    .lte('transfer_date', period.to)
    .order('transfer_date', { ascending: false });
  if (selectedAssociation) {
    const bankIds = bAccounts.map((a: any) => a.id).join(',');
    transferQuery = bAccounts.length
      ? transferQuery.or(`from_bank_account_id.in.(${bankIds}),to_bank_account_id.in.(${bankIds})`)
      : transferQuery.in('id', []);
  }

  const { data: transfers } = await transferQuery;
  const bankTransfers = (transfers ?? []) as any[];

  // Cash in/out for the period, summed in the database over TRUE cash
  // accounts only (account_type = 'cash' — not the whole 1000–1999 range,
  // which also contains A/R and prepaids). Fetching every line in the period
  // and filtering in the app stopped at 1,000 rows.
  // A debit to a cash account increases cash (inflow); a credit decreases it (outflow).
  const cashTotals = await journalLineTotals(db, {
    accountTypes: ['cash'],
    associationIds: selectedAssociation ? [selectedAssociation] : null,
    from: period.from,
    to: period.to,
  });
  const operatingInflows  = cashTotals.reduce((s, r) => s + r.debit_total, 0);
  const operatingOutflows = cashTotals.reduce((s, r) => s + r.credit_total, 0);
  const netCashFlow = operatingInflows - operatingOutflows;

  // Ending balance per bank account = net of its GL account's posted lines through the as-of date.
  const bankGlIds = bAccounts.map((a: any) => a.gl_account_id).filter(Boolean);
  const balByGl = await bankGlBalances(db, bankGlIds, period.to, selectedAssociation || undefined);

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
                    <td className="px-5 py-2 font-medium text-gray-900">{a.gl_account_id ? <DrillLink href={glDrillHref(a.gl_account_id, { period, selectedAssociation })}>{a.name}</DrillLink> : a.name}</td>
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
  def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope, selectedAccount,
}: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;

  // Fetch all journal lines with entries for the period, grouped by GL account
  let glAccountQuery = db
    .from('gl_accounts')
    .select('id, number, name, account_type')
    // All accounts, not only active ones: an inactive account can still have
    // posted lines. Accounts without activity are hidden below.
    .order('number');
  if (selectedAssociation) glAccountQuery = glAccountQuery.or(`association_id.is.null,association_id.eq.${selectedAssociation}`);
  if (selectedAccount) glAccountQuery = glAccountQuery.eq('id', selectedAccount);
  const { data: glAccounts } = await glAccountQuery;

  const accounts = (glAccounts ?? []) as any[];

  // Fetch journal_lines with entry info — every page of them (one request
  // stops at 1,000 rows, which silently cut the ledger short).
  const buildLineQuery = () => {
    let lineQuery = db
      .from('journal_lines')
      .select(`id, debit_amount, credit_amount, memo, gl_account_id, entry_id, sort_order,
        journal_entries!inner(id, entry_date, description, memo, reference_number, posted)`)
      .eq('journal_entries.posted', true)
      .gte('journal_entries.entry_date', period.from)
      .lte('journal_entries.entry_date', period.to)
      .order('sort_order')
      .order('id');
    if (selectedAssociation) lineQuery = lineQuery.eq('association_id', selectedAssociation);
    if (selectedAccount) lineQuery = lineQuery.eq('gl_account_id', selectedAccount);
    return lineQuery;
  };
  const { rows: journalLines } = await fetchAllRows<any>(buildLineQuery);

  // A general ledger needs the balance brought forward before the selected
  // period. Without it, the report cannot provide an accurate running balance.
  // Summed in the database through the day before the period starts.
  const dayBeforeFrom = new Date(Date.parse(`${period.from}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const openingTotals: Record<string, { debit: number; credit: number }> = accounts.length > 0
    ? await ledgerTotalsByAccount(db, {
        glAccountIds: accounts.map((account: any) => account.id),
        associationIds: selectedAssociation ? [selectedAssociation] : null,
        to: dayBeforeFrom,
      })
    : {};

  // Group lines by gl_account_id
  const grouped = new Map<string, any[]>();
  for (const line of journalLines) {
    const accId = line.gl_account_id;
    if (!grouped.has(accId)) grouped.set(accId, []);
    grouped.get(accId)!.push(line);
  }
  for (const accountLines of grouped.values()) {
    accountLines.sort((left, right) => {
      const leftDate = left.journal_entries?.entry_date ?? '';
      const rightDate = right.journal_entries?.entry_date ?? '';
      return leftDate.localeCompare(rightDate)
        || Number(left.sort_order ?? 0) - Number(right.sort_order ?? 0)
        || String(left.id).localeCompare(String(right.id));
    });
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
        {selectedAccount && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200/70 bg-white px-4 py-2.5 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <span className="text-gray-600">
              Drill-down: <span className="font-medium text-gray-900">{accounts[0] ? `${accounts[0].number} — ${accounts[0].name}` : 'selected account'}</span>
              {selectedAssociation && <> · {associations.find((a: any) => a.id === selectedAssociation)?.name ?? 'association'}</>}
            </span>
            <Link
              href={`/reports/general_ledger?${new URLSearchParams({ preset: 'custom', from: period.from, to: period.to, ...(selectedAssociation ? { association: selectedAssociation } : {}) }).toString()}`}
              className="text-[13px] font-medium text-gray-500 hover:text-gray-900"
            >
              Show all accounts
            </Link>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            let runningBalance = normalBalance(acc, openingTotals);
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
                        <th className="px-4 py-2 text-right font-semibold">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l: any) => {
                        const entry = l.journal_entries;
                        runningBalance += normalBalance(acc, {
                          [acc.id]: {
                            debit: Number(l.debit_amount ?? 0),
                            credit: Number(l.credit_amount ?? 0),
                          },
                        });
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
                            <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900">{money(runningBalance)}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-xs">
                        <td className="px-5 py-2" colSpan={3}>Account Total</td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-900">{money(sumDebit)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-900">{money(sumCredit)}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-gray-900">{money(runningBalance)}</td>
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

  // Every open charge (one request stopped at 1,000 rows and understated A/R).
  const { rows } = await fetchAllRows<any>(() => {
    let q = (supabase as any).from('aged_receivables').select('*').order('due_date').order('charge_id');
    if (selectedAssociation) q = q.eq('association_id', selectedAssociation);
    return q;
  });
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
      rail={<ReportRightRail def={def} runs={runs} associations={associations} period={period} selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} selectedScope={selectedScope} isLive isAsOfToday />}
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
// ═══════════════════════════════════════════════════════════════
// OWNER 1099 (summary + detail) — owners flagged send_1099, with
// paid owner payables in the period. owner_financial_details is
// finance-staff-only via RLS, so non-finance staff see an empty set.
// ═══════════════════════════════════════════════════════════════
async function Owner1099View({
  def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope, detail,
}: ReportContext & { detail: boolean }) {
  const supabase = await createClient();
  const db = supabase as any;

  const { data: finRows } = await db
    .from('owner_financial_details')
    .select('owner_id, taxpayer_name, taxpayer_id, sending_preference_1099, electronic_1099_consent, owners(id, full_name, email)')
    .eq('send_1099', true);
  const flagged = (finRows ?? []) as any[];
  const flaggedIds = flagged.map((r: any) => r.owner_id);

  // 1099 amounts are reported by the year the money was PAID, so filter on
  // paid_at (timestamptz) using the period's day bounds in the display zone.
  let payables: any[] = [];
  let payTruncated = false;
  let payError: string | null = null;
  if (flaggedIds.length > 0) {
    const zone = displayTimeZone();
    const paidFrom = wallDateTimeToIso(period.from, zone) ?? `${period.from}T00:00:00Z`;
    const paidBefore = wallDateTimeToIso(addDays(period.to, 1), zone) ?? `${addDays(period.to, 1)}T00:00:00Z`;
    const buildPayQ = () => {
      let payQ = db
        .from('owner_payables')
        .select('id, owner_id, association_id, amount, memo, payable_type, payable_date, paid_at, status, associations(name)')
        .in('owner_id', flaggedIds)
        .eq('status', 'paid')
        .is('archived_at', null)
        .gte('paid_at', paidFrom)
        .lt('paid_at', paidBefore)
        .order('paid_at', { ascending: false })
        .order('id');
      if (selectedAssociation) payQ = payQ.eq('association_id', selectedAssociation);
      return payQ;
    };
    const res = await fetchAllRows<any>(buildPayQ);
    payables = res.rows;
    payTruncated = res.truncated;
    payError = res.error;
  }

  const paidByOwner = new Map<string, { total: number; count: number }>();
  for (const p of payables) {
    const cur = paidByOwner.get(p.owner_id) ?? { total: 0, count: 0 };
    cur.total += Number(p.amount ?? 0);
    cur.count += 1;
    paidByOwner.set(p.owner_id, cur);
  }
  const totalPaid = payables.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const mask = (v: string | null) => (v ? `•••-${v.slice(-4)}` : '—');

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/reports" className="transition-colors hover:text-gray-700">Reports</Link>
              {' · '}
              <span className="text-gray-400">{CATEGORY_LABELS[def.category] ?? def.category}</span>
              {' · '}
              <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold uppercase text-green-700">live</span>
            </>
          }
          title={def.name}
          subtitle={`${period.from} → ${period.to}`}
        />
      }
      rail={<ReportRightRail def={def} runs={runs} associations={associations} period={period}
        selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} selectedScope={selectedScope} isLive />}
    >
      <div className="space-y-4">
        {payError && <Alert tone="danger" title="Could not load owner payables.">{payError}</Alert>}
        {payTruncated && <Alert tone="warning" title="Results truncated.">Only the first {payables.length.toLocaleString()} paid payables are included; narrow the period or association.</Alert>}
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Owners flagged for 1099" value={flagged.length} tone="neutral" sub="Send 1099? = Yes" />
          <Tile label="Paid this period" value={money(totalPaid)} tone="positive" sub={`${payables.length} payables`} />
          <Tile label="Period" value={period.label} tone="neutral" sub={`${period.from} → ${period.to}`} />
        </div>

        {flagged.length === 0 ? (
          <Section title="No owners flagged" subtitle="Flag owners on their profile">
            <p className="px-5 py-6 text-sm text-gray-500">
              No owners have &quot;Send 1099?&quot; enabled (or your role does not include finance access).
              Enable it in the owner profile under Federal Tax, Payout &amp; Accounting Preferences.
            </p>
          </Section>
        ) : detail ? (
          <Section title="Paid owner payables" subtitle={`${payables.length} rows`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-5 py-2 text-left font-semibold">Date</th>
                    <th className="px-4 py-2 text-left font-semibold">Owner</th>
                    <th className="px-4 py-2 text-left font-semibold">Association</th>
                    <th className="px-4 py-2 text-left font-semibold">Type</th>
                    <th className="px-4 py-2 text-left font-semibold">Memo</th>
                    <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payables.map((p: any) => {
                    const fin = flagged.find((f: any) => f.owner_id === p.owner_id);
                    return (
                      <tr key={p.id}>
                        <td className="px-5 py-2 tabular-nums">{date(p.paid_at ?? p.payable_date)}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{fin?.owners?.full_name ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-600">{p.associations?.name ?? '—'}</td>
                        <td className="px-4 py-2 capitalize text-gray-600">{String(p.payable_type ?? '').replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2 text-gray-600">{p.memo ?? '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{money(p.amount)}</td>
                      </tr>
                    );
                  })}
                  {payables.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-6 text-center text-gray-500">No paid owner payables in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        ) : (
          <Section title="1099 summary by owner" subtitle={`${flagged.length} owners`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-5 py-2 text-left font-semibold">Owner</th>
                    <th className="px-4 py-2 text-left font-semibold">Taxpayer name</th>
                    <th className="px-4 py-2 text-left font-semibold">Taxpayer ID</th>
                    <th className="px-4 py-2 text-left font-semibold">Preference</th>
                    <th className="px-4 py-2 text-left font-semibold">E-consent</th>
                    <th className="px-4 py-2 text-right font-semibold">Paid (period)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {flagged.map((f: any) => {
                    const paid = paidByOwner.get(f.owner_id) ?? { total: 0, count: 0 };
                    return (
                      <tr key={f.owner_id}>
                        <td className="px-5 py-2 font-medium text-gray-900">
                          <Link href={`/owners/${f.owner_id}`} className="hover:underline">{f.owners?.full_name ?? '—'}</Link>
                        </td>
                        <td className="px-4 py-2 text-gray-600">{f.taxpayer_name ?? '—'}</td>
                        <td className="px-4 py-2 tabular-nums text-gray-600">{mask(f.taxpayer_id)}</td>
                        <td className="px-4 py-2 capitalize text-gray-600">{f.sending_preference_1099}</td>
                        <td className="px-4 py-2 text-gray-600">{f.electronic_1099_consent ? 'Yes' : 'No'}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{money(paid.total)}<span className="ml-1 text-xs text-gray-400">({paid.count})</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        )}
      </div>
    </Workspace>
  );
}

// ═══════════════════════════════════════════════════════════════
// OWNER VEHICLE INFO — active parking assignments with vehicle data
// ═══════════════════════════════════════════════════════════════
async function VehicleInfoView({
  def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope,
}: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;

  const [{ data }, { data: personVehicles }] = await Promise.all([
    db.from('parking_assignments')
      .select('id, vehicle_make, vehicle_model, vehicle_color, license_plate, insurance_company, status, occupant_name, owners(id, full_name), parking_spaces(label), units(unit_number, buildings(associations(id, name)))')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    db.from('owner_vehicles')
      .select('id, make, model, color, year, license_plate, plate_state, owners(id, full_name)')
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
  ]);

  let rows = (data ?? []) as any[];
  if (selectedAssociation) {
    rows = rows.filter((r: any) => r.units?.buildings?.associations?.id === selectedAssociation);
  }
  // Person-level vehicles (owner record, no parking space required)
  const ownerRows = ((personVehicles ?? []) as any[]).map((v: any) => ({
    id: `ov-${v.id}`,
    vehicle_make: v.make,
    vehicle_model: v.model,
    vehicle_color: [v.year, v.color].filter(Boolean).join(' '),
    license_plate: v.license_plate ? `${v.license_plate}${v.plate_state ? ` (${v.plate_state})` : ''}` : null,
    insurance_company: null,
    occupant_name: null,
    owners: v.owners,
    parking_spaces: null,
    units: null,
  }));
  rows = [...ownerRows, ...rows];
  const withVehicle = rows.filter((r: any) => r.vehicle_make || r.vehicle_model || r.license_plate);

  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/reports" className="transition-colors hover:text-gray-700">Reports</Link>
              {' · '}
              <span className="text-gray-400">{CATEGORY_LABELS[def.category] ?? def.category}</span>
              {' · '}
              <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold uppercase text-green-700">live</span>
            </>
          }
          title={def.name}
          subtitle="Active parking assignments"
        />
      }
      rail={<ReportRightRail def={def} runs={runs} associations={associations} period={period}
        selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} selectedScope={selectedScope} isLive />}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Vehicles on file" value={withVehicle.length} tone="neutral" sub="From parking assignments" />
          <Tile label="Active assignments" value={rows.length} tone="neutral" />
          <Tile label="Missing vehicle info" value={rows.length - withVehicle.length} tone={rows.length - withVehicle.length > 0 ? 'danger' : 'positive'} />
        </div>
        <Section title="Vehicles" subtitle={`${rows.length} assignments`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-5 py-2 text-left font-semibold">Owner / occupant</th>
                  <th className="px-4 py-2 text-left font-semibold">Association</th>
                  <th className="px-4 py-2 text-left font-semibold">Unit</th>
                  <th className="px-4 py-2 text-left font-semibold">Vehicle</th>
                  <th className="px-4 py-2 text-left font-semibold">Plate</th>
                  <th className="px-4 py-2 text-left font-semibold">Space</th>
                  <th className="px-4 py-2 text-left font-semibold">Insurance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r: any) => (
                  <tr key={r.id}>
                    <td className="px-5 py-2 font-medium text-gray-900">
                      {r.owners?.id
                        ? <Link href={`/owners/${r.owners.id}`} className="hover:underline">{r.owners.full_name}</Link>
                        : (r.occupant_name ?? '—')}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{r.units?.buildings?.associations?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.units?.unit_number ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{[r.vehicle_color, r.vehicle_make, r.vehicle_model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-4 py-2 tabular-nums text-gray-600">{r.license_plate ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.parking_spaces?.label ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{r.insurance_company ?? '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-6 text-center text-gray-500">No active parking assignments.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </Workspace>
  );
}

// Shared: derived balance per bank account GL through a date
/** Debit-minus-credit balance per bank GL account through `toDate`, summed in the database. */
async function bankGlBalances(db: any, glIds: string[], toDate: string, associationId?: string) {
  const balByGl: Record<string, number> = {};
  if (glIds.length === 0) return balByGl;
  const map = await glDebitBalances(db, { glAccountIds: glIds, associationIds: associationId ? [associationId] : null, to: toDate });
  for (const [id, bal] of map) balByGl[id] = bal;
  return balByGl;
}

function LiveReportShell({ ctx, subtitle, children }: { ctx: ReportContext; subtitle: string; children: React.ReactNode }) {
  const { def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope } = ctx;
  return (
    <Workspace
      header={
        <WorkspaceHeader
          eyebrow={
            <>
              <Link href="/reports" className="transition-colors hover:text-gray-700">Reports</Link>
              {' · '}
              <span className="text-gray-400">{CATEGORY_LABELS[def.category] ?? def.category}</span>
              {' · '}
              <span className="rounded bg-green-100 px-1.5 py-0.5 font-semibold uppercase text-green-700">live</span>
            </>
          }
          title={def.name}
          subtitle={subtitle}
        />
      }
      rail={<ReportRightRail def={def} runs={runs} associations={associations} period={period}
        selectedAssociation={selectedAssociation} selectedPreset={selectedPreset} selectedScope={selectedScope} isLive />}
    >
      <div className="space-y-4">{children}</div>
    </Workspace>
  );
}

const thCls = 'px-4 py-2 text-left font-semibold';
const thRight = 'px-4 py-2 text-right font-semibold';

// ═══ LOAN STATEMENT ═══
async function LoanStatementView(ctx: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;
  let q = db.from('association_loans').select('*, associations(name)').is('archived_at', null).order('created_at');
  if (ctx.selectedAssociation) q = q.eq('association_id', ctx.selectedAssociation);
  const { data } = await q;
  const loans = (data ?? []) as any[];
  const totalBalance = loans.reduce((s, l) => s + Number(l.current_balance ?? 0), 0);
  const active = loans.filter((l) => l.status === 'active');

  return (
    <LiveReportShell ctx={ctx} subtitle="Loans and mortgages by association">
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Active loans" value={active.length} tone="neutral" />
        <Tile label="Total outstanding" value={money(totalBalance)} tone={totalBalance > 0 ? 'danger' : 'positive'} />
        <Tile label="Next payment" value={active.map((l) => l.next_payment_date).filter(Boolean).sort()[0] ? date(active.map((l) => l.next_payment_date).filter(Boolean).sort()[0]) : '—'} tone="neutral" />
      </div>
      <Section title="Loans" subtitle={`${loans.length} records`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Lender</th>
                <th className={thCls}>Association</th>
                <th className={thCls}>Type</th>
                <th className={thRight}>Original</th>
                <th className={thRight}>Balance</th>
                <th className={thRight}>Rate</th>
                <th className={thRight}>Payment</th>
                <th className={thCls}>Next due</th>
                <th className={thCls}>Matures</th>
                <th className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loans.map((l: any) => (
                <tr key={l.id}>
                  <td className="px-5 py-2 font-medium text-gray-900">{l.lender}</td>
                  <td className="px-4 py-2 text-gray-600">{l.associations?.name ?? '—'}</td>
                  <td className="px-4 py-2 capitalize text-gray-600">{String(l.loan_type).replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{l.original_principal != null ? money(l.original_principal) : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{l.current_balance != null ? money(l.current_balance) : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{l.interest_rate != null ? `${l.interest_rate}%` : '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{l.payment_amount != null ? money(l.payment_amount) : '—'}</td>
                  <td className="px-4 py-2 tabular-nums text-gray-600">{l.next_payment_date ? date(l.next_payment_date) : '—'}</td>
                  <td className="px-4 py-2 tabular-nums text-gray-600">{l.maturity_date ? date(l.maturity_date) : '—'}</td>
                  <td className="px-4 py-2 capitalize text-gray-600">{String(l.status).replace(/_/g, ' ')}</td>
                </tr>
              ))}
              {loans.length === 0 && (
                <tr><td colSpan={10} className="px-5 py-6 text-center text-gray-500">No loans on file. Add them on the association Profile tab.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </LiveReportShell>
  );
}

// ═══ RESERVE FUND ANALYSIS ═══
async function ReserveFundView(ctx: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;
  let sq = db.from('reserve_fund_settings').select('*, associations(id, name)');
  if (ctx.selectedAssociation) sq = sq.eq('association_id', ctx.selectedAssociation);
  const [{ data: settings }, { data: reserveBanks }] = await Promise.all([
    sq,
    db.from('bank_accounts').select('id, name, association_id, gl_account_id, fund_type').eq('fund_type', 'reserve').is('archived_at', null),
  ]);
  const rows = (settings ?? []) as any[];
  const banks = (reserveBanks ?? []) as any[];
  const balByGl = await bankGlBalances(db, banks.map((b) => b.gl_account_id).filter(Boolean), ctx.period.to);
  const balanceByAssoc = new Map<string, number>();
  for (const b of banks) {
    if (!b.association_id) continue;
    balanceByAssoc.set(b.association_id, (balanceByAssoc.get(b.association_id) ?? 0) + (balByGl[b.gl_account_id] ?? 0));
  }
  const totalTarget = rows.reduce((s, r) => s + Number(r.target_amount ?? 0), 0);
  const totalActual = [...balanceByAssoc.values()].reduce((s, v) => s + v, 0);

  return (
    <LiveReportShell ctx={ctx} subtitle={`Reserve position as of ${ctx.period.to}`}>
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Reserve balance (banks)" value={money(totalActual)} tone="positive" sub="Accounts designated 'reserve'" />
        <Tile label="Target funding" value={money(totalTarget)} tone="neutral" />
        <Tile label="Funded vs target" value={totalTarget > 0 ? `${Math.round((totalActual / totalTarget) * 100)}%` : '—'} tone={totalTarget > 0 && totalActual >= totalTarget ? 'positive' : 'neutral'} />
      </div>
      <Section title="Reserve fund by association" subtitle={`${rows.length} configured`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Association</th>
                <th className={thRight}>Reserve balance</th>
                <th className={thRight}>Target</th>
                <th className={thRight}>% of target</th>
                <th className={thRight}>Monthly contribution</th>
                <th className={thRight}>Study % funded</th>
                <th className={thCls}>Last study</th>
                <th className={thCls}>Next due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r: any) => {
                const bal = balanceByAssoc.get(r.association_id) ?? 0;
                const pct = r.target_amount ? Math.round((bal / Number(r.target_amount)) * 100) : null;
                return (
                  <tr key={r.association_id}>
                    <td className="px-5 py-2 font-medium text-gray-900">{r.associations?.name ?? '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(bal)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.target_amount != null ? money(r.target_amount) : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{pct != null ? `${pct}%` : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.monthly_contribution != null ? money(r.monthly_contribution) : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.percent_funded != null ? `${r.percent_funded}%` : '—'}</td>
                    <td className="px-4 py-2 tabular-nums text-gray-600">{r.last_study_date ? date(r.last_study_date) : '—'}</td>
                    <td className="px-4 py-2 tabular-nums text-gray-600">{r.next_study_due ? date(r.next_study_due) : '—'}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-6 text-center text-gray-500">No reserve settings configured yet. Set targets on each association&apos;s Profile tab.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </LiveReportShell>
  );
}

// ═══ FUND BALANCE SHEET / TRUST ACCOUNT BALANCE ═══
async function FundBalanceView(ctx: ReportContext & { trustOnly: boolean }) {
  const supabase = await createClient();
  const db = supabase as any;
  let bq = db.from('bank_accounts').select('id, name, bank_name, fund_type, association_id, gl_account_id, associations!bank_accounts_association_id_fkey(name)').is('archived_at', null).order('name');
  if (ctx.selectedAssociation) bq = bq.eq('association_id', ctx.selectedAssociation);
  const { data } = await bq;
  let banks = (data ?? []) as any[];
  if (ctx.trustOnly) banks = banks.filter((b) => b.fund_type && b.fund_type !== 'operating' && b.fund_type !== 'petty_cash');
  const balByGl = await bankGlBalances(db, banks.map((b) => b.gl_account_id).filter(Boolean), ctx.period.to, ctx.selectedAssociation || undefined);

  const groups = new Map<string, any[]>();
  for (const b of banks) {
    const k = b.fund_type ?? 'unassigned';
    groups.set(k, [...(groups.get(k) ?? []), b]);
  }
  const total = banks.reduce((s, b) => s + (balByGl[b.gl_account_id] ?? 0), 0);

  return (
    <LiveReportShell ctx={ctx} subtitle={ctx.trustOnly ? `Trust-designated funds as of ${ctx.period.to}` : `Balances by fund as of ${ctx.period.to}`}>
      <div className="grid grid-cols-3 gap-3">
        <Tile label={ctx.trustOnly ? 'Trust funds total' : 'All funds total'} value={money(total)} tone="positive" />
        <Tile label="Accounts" value={banks.length} tone="neutral" />
        <Tile label="Fund types" value={groups.size} tone="neutral" />
      </div>
      {[...groups.entries()].map(([fund, accts]) => {
        const sub = accts.reduce((s: number, b: any) => s + (balByGl[b.gl_account_id] ?? 0), 0);
        return (
          <Section key={fund} title={fund.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} subtitle={`${accts.length} accounts · ${money(sub)}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                  <tr>
                    <th className="px-5 py-2 text-left font-semibold">Account</th>
                    <th className={thCls}>Bank</th>
                    <th className={thCls}>Association</th>
                    <th className={thRight}>Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accts.map((b: any) => (
                    <tr key={b.id}>
                      <td className="px-5 py-2 font-medium text-gray-900">{b.name}</td>
                      <td className="px-4 py-2 text-gray-600">{b.bank_name ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-600">{b.associations?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money(balByGl[b.gl_account_id] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        );
      })}
      {banks.length === 0 && (
        <Section title="No accounts">
          <p className="px-5 py-6 text-sm text-gray-500">
            {ctx.trustOnly
              ? 'No bank accounts are designated as trust funds (reserve, special assessment, escrow…). Set a fund type on each bank account.'
              : 'No bank accounts found.'}
          </p>
        </Section>
      )}
    </LiveReportShell>
  );
}

// ═══ TRUST ACCOUNT DETAIL ═══
async function TrustDetailView(ctx: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;
  const { data: banksData } = await db.from('bank_accounts').select('id, name, fund_type, gl_account_id').is('archived_at', null);
  const trustBanks = ((banksData ?? []) as any[]).filter((b) => b.fund_type && b.fund_type !== 'operating' && b.fund_type !== 'petty_cash');
  const glIds = trustBanks.map((b) => b.gl_account_id).filter(Boolean);
  const nameByGl = new Map(trustBanks.map((b) => [b.gl_account_id, `${b.name} (${b.fund_type})`]));

  let lines: any[] = [];
  if (glIds.length > 0) {
    // Every page of trust activity (one request stops at 1,000 rows).
    const { rows: data } = await fetchAllRows<any>(() => {
      let lq = db
        .from('journal_lines')
        .select('id, gl_account_id, debit_amount, credit_amount, association_id, journal_entries!inner(entry_date, posted, memo, description)')
        .in('gl_account_id', glIds)
        .eq('journal_entries.posted', true)
        .gte('journal_entries.entry_date', ctx.period.from)
        .lte('journal_entries.entry_date', ctx.period.to)
        .order('id');
      if (ctx.selectedAssociation) lq = lq.eq('association_id', ctx.selectedAssociation);
      return lq;
    });
    lines = (data as any[]).sort((a, b) => String(b.journal_entries?.entry_date).localeCompare(String(a.journal_entries?.entry_date)));
  }
  const inflows = lines.reduce((s, l) => s + Number(l.debit_amount ?? 0), 0);
  const outflows = lines.reduce((s, l) => s + Number(l.credit_amount ?? 0), 0);

  return (
    <LiveReportShell ctx={ctx} subtitle={`Trust activity ${ctx.period.from} → ${ctx.period.to}`}>
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Deposits" value={money(inflows)} tone="positive" />
        <Tile label="Withdrawals" value={money(outflows)} tone="danger" />
        <Tile label="Net" value={money(inflows - outflows)} tone={inflows - outflows >= 0 ? 'positive' : 'danger'} />
      </div>
      <Section title="Trust account activity" subtitle={`${lines.length} entries`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Date</th>
                <th className={thCls}>Account</th>
                <th className={thCls}>Memo</th>
                <th className={thRight}>Debit</th>
                <th className={thRight}>Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.slice(0, 200).map((l: any) => (
                <tr key={l.id}>
                  <td className="px-5 py-2 tabular-nums">{date(l.journal_entries?.entry_date)}</td>
                  <td className="px-4 py-2 text-gray-600">{nameByGl.get(l.gl_account_id) ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{l.journal_entries?.memo ?? l.journal_entries?.description ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{Number(l.debit_amount) ? money(l.debit_amount) : ''}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{Number(l.credit_amount) ? money(l.credit_amount) : ''}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-gray-500">No trust account activity in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </LiveReportShell>
  );
}

// ═══ MANAGEMENT FEE SUMMARY ═══
async function ManagementFeeSummaryView(ctx: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;
  let q = db.from('management_fees').select('*, associations(name)')
    .gte('month', ctx.period.from.slice(0, 7) + '-01')
    .lte('month', ctx.period.to)
    .order('month', { ascending: false });
  if (ctx.selectedAssociation) q = q.eq('association_id', ctx.selectedAssociation);
  const { data } = await q;
  const rows = (data ?? []) as any[];
  const cents = (v: any) => Number(v ?? 0) / 100;
  const totalFees = rows.reduce((s, r) => s + cents(r.fee_amount_cents), 0);
  const totalCollected = rows.reduce((s, r) => s + cents(r.collected_cents), 0);

  return (
    <LiveReportShell ctx={ctx} subtitle={`Management fees ${ctx.period.from} → ${ctx.period.to}`}>
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Fees billed" value={money(totalFees)} tone="neutral" />
        <Tile label="Collected" value={money(totalCollected)} tone="positive" />
        <Tile label="Months × associations" value={rows.length} tone="neutral" />
      </div>
      <Section title="Fee summary" subtitle={`${rows.length} rows`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Month</th>
                <th className={thCls}>Association</th>
                <th className={thRight}>Doors</th>
                <th className={thRight}>Fee</th>
                <th className={thRight}>Collected</th>
                <th className={thRight}>Delinquent</th>
                <th className={thRight}>Avg / door</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r: any) => (
                <tr key={r.id}>
                  <td className="px-5 py-2 tabular-nums">{String(r.month).slice(0, 7)}</td>
                  <td className="px-4 py-2 text-gray-600">{r.associations?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.door_count ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(cents(r.fee_amount_cents))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(cents(r.collected_cents))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(cents(r.delinquent_cents))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(cents(r.avg_per_door_cents))}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-6 text-center text-gray-500">No management fee records in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </LiveReportShell>
  );
}

// ═══ OWNER PREPAID ═══
async function OwnerPrepaidView(ctx: ReportContext) {
  const supabase = await createClient();
  const db = supabase as any;
  const [{ data: balances }, { data: occs }] = await Promise.all([
    db.from('unit_balances').select('unit_id, unit_number, balance').lt('balance', 0),
    db.from('occupancies').select('owner_id, unit_id, owners(id, full_name, email), units(unit_number, buildings(associations(id, name)))').eq('status', 'current'),
  ]);
  const occByUnit = new Map(((occs ?? []) as any[]).map((o: any) => [o.unit_id, o]));
  let rows = ((balances ?? []) as any[]).map((b: any) => {
    const o = occByUnit.get(b.unit_id);
    return {
      unitId: b.unit_id,
      unitNumber: b.unit_number ?? o?.units?.unit_number ?? '—',
      credit: Math.abs(Number(b.balance ?? 0)),
      owner: o?.owners ?? null,
      association: o?.units?.buildings?.associations ?? null,
    };
  });
  if (ctx.selectedAssociation) rows = rows.filter((r) => r.association?.id === ctx.selectedAssociation);
  rows.sort((a, b) => b.credit - a.credit);
  const total = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <LiveReportShell ctx={ctx} subtitle="Owners with prepaid / credit balances">
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Total prepaid credit" value={money(total)} tone="positive" />
        <Tile label="Units in credit" value={rows.length} tone="neutral" />
        <Tile label="Largest credit" value={rows[0] ? money(rows[0].credit) : '—'} tone="neutral" />
      </div>
      <Section title="Prepaid balances" subtitle={`${rows.length} units`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-5 py-2 text-left font-semibold">Owner</th>
                <th className={thCls}>Association</th>
                <th className={thCls}>Unit</th>
                <th className={thRight}>Prepaid credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.unitId}>
                  <td className="px-5 py-2 font-medium text-gray-900">
                    {r.owner ? <Link href={`/owners/${r.owner.id}`} className="hover:underline">{r.owner.full_name}</Link> : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{r.association?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{r.unitNumber}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(r.credit)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-gray-500">No prepaid credits — no unit currently carries a negative balance.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </LiveReportShell>
  );
}

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
              {supportedReportOutputFormats(def.output_formats).map((f) => (
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
async function ReportRightRail({
  def, runs, associations, period, selectedAssociation, selectedPreset, selectedScope, isLive, supportsLiveExport, isAsOfToday,
}: {
  def: any; runs: any[]; associations: any[]; period: Period;
  selectedAssociation: string; selectedPreset: string; selectedScope: string; isLive?: boolean; supportsLiveExport?: boolean; isAsOfToday?: boolean;
}) {
  // Owner / unit pickers (RLS-scoped) instead of raw-UUID text boxes.
  const unitRequired = def.slug === 'owner_ledger';
  const pickerDb = (await createClient()) as any;
  // PostgREST caps a request at 1,000 rows (.limit(2000) did not lift it), so page through.
  const [{ rows: pickerUnits }, { rows: pickerOwners }] = isLive
    ? [{ rows: [] as any[] }, { rows: [] as any[] }]
    : await Promise.all([
        fetchAllRows<any>(() => pickerDb.from('units').select('id, unit_number, buildings(associations(name))').is('archived_at', null).order('unit_number').order('id'), { maxRows: 20000 }),
        fetchAllRows<any>(() => pickerDb.from('owners').select('id, full_name').is('archived_at', null).order('full_name').order('id'), { maxRows: 20000 }),
      ]);
  const unitLabel = (u: any) => `${u.buildings?.associations?.name ?? 'Association'} · Unit ${u.unit_number}`;
  const sortedUnits = [...(pickerUnits ?? [])].sort((a: any, b: any) =>
    unitLabel(a).localeCompare(unitLabel(b), undefined, { numeric: true }));
  const lastSuccess = runs.find((r: any) => r.status === 'succeeded');
  const inFlight = runs.find((r: any) => r.status === 'queued' || r.status === 'running');
  const exportEnabled = supportsLiveExport
    || ['trial_balance', 'balance_sheet', 'income_statement', 'general_ledger', 'ar_aging'].includes(def.slug);

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
        {isLive ? 'Live report' : 'Run this report'}
      </div>

      {isLive && !exportEnabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
          This report is calculated live from posted accounting entries. File export is temporarily unavailable because the queued export service does not yet have an audited data source for this report. Use the displayed totals for review; do not rely on a generated file until export verification is complete.
        </div>
      ) : (
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
            {!isLive && <option value="owner">Owner</option>}
            {!isLive && <option value="unit">Unit</option>}
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

        {!isLive && (
          <div className="grid grid-cols-1 gap-2">
            {!unitRequired && (
              <div>
                <label className="mb-0.5 block text-[11px] text-gray-500">Homeowner</label>
                <select
                  name="param_owner_id"
                  defaultValue=""
                  className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">All homeowners</option>
                  {(pickerOwners ?? []).map((o: any) => <option key={o.id} value={o.id}>{o.full_name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-0.5 block text-[11px] text-gray-500">Unit{unitRequired ? ' (required)' : ''}</label>
              <select
                name="param_unit_id"
                defaultValue=""
                required={unitRequired}
                className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">{unitRequired ? 'Select a unit…' : 'All units'}</option>
                {sortedUnits.map((u: any) => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
              </select>
            </div>
          </div>
        )}

        {isAsOfToday ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            A/R aging is calculated as of today. It does not use an arbitrary reporting period.
          </div>
        ) : (
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
        )}

        {/* Format */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-700">Output format</label>
          <select
            name="output_format"
            defaultValue={def.output_formats?.[0] ?? 'csv'}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            {supportedReportOutputFormats(def.output_formats).map((f) => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </select>
        </div>

        <Button type="submit" className="w-full">
          {isLive ? 'Export to file' : 'Run now'}
        </Button>
      </form>
      )}

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
  // "Today" is the calendar day in the request's display zone, not UTC (late
  // evening in the US was already "tomorrow" and could jump a month/year).
  const [ty, tm, td] = todayInZone().split('-').map(Number);
  const today = { y: ty, m: tm - 1, d: td };
  const ymd = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
  const todayStr = ymd(today.y, today.m, today.d);
  const firstOfMonth = (y: number, m: number) => ymd(y, m, 1);
  const lastOfMonth  = (y: number, m: number) => ymd(y, m + 1, 0);

  if (preset === 'custom') {
    return {
      from:  customFrom ?? firstOfMonth(today.y, today.m),
      to:    customTo   ?? todayStr,
      label: 'Custom',
    };
  }
  if (preset === 'last_month') {
    const d = new Date(Date.UTC(today.y, today.m - 1, 1));
    return { from: firstOfMonth(d.getUTCFullYear(), d.getUTCMonth()), to: lastOfMonth(d.getUTCFullYear(), d.getUTCMonth()), label: 'Last month' };
  }
  if (preset === 'this_quarter') {
    const q = Math.floor(today.m / 3) * 3;
    return { from: firstOfMonth(today.y, q), to: todayStr, label: 'This quarter' };
  }
  if (preset === 'last_quarter') {
    const q = Math.floor(today.m / 3) * 3 - 3;
    const y = q < 0 ? today.y - 1 : today.y;
    const m = (q + 12) % 12;
    return { from: firstOfMonth(y, m), to: lastOfMonth(y, m + 2), label: 'Last quarter' };
  }
  if (preset === 'ytd') {
    return { from: ymd(today.y, 0, 1), to: todayStr, label: 'Year to date' };
  }
  if (preset === 'last_year') {
    return { from: ymd(today.y - 1, 0, 1), to: ymd(today.y - 1, 11, 31), label: 'Last year' };
  }
  // default: this_month
  return { from: firstOfMonth(today.y, today.m), to: todayStr, label: 'This month' };
}

/** YYYY-MM-DD shifted by `days` calendar days. */
function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
