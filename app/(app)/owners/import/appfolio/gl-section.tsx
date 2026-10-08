'use client';

// AppFolio general ledger, two sections the import page places separately:
//   GlImportSection            — Chart of Accounts export -> preview -> add the
//                                accounts to the company-wide chart.
//   TrialBalanceTieOutSection  — Trial Balance export -> read-only tie-out
//                                against the posted ledger (render it last).
// Files are read in the browser (lib/imports/appfolio-gl); the server actions
// re-check everything and the tie-out writes nothing.
import * as React from 'react';
import { Alert, Badge, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import {
  TIE_OUT_ALL_ASSOCIATIONS, parseAppfolioChartOfAccounts, parseAppfolioTrialBalance,
  type AppfolioGlAccount, type AppfolioTrialBalanceAmounts, type AppfolioTrialBalanceRow,
} from '@/lib/imports/appfolio-gl';
import type { GlImportSummary, TieOutInputRow, TieOutLine, TieOutOptions, TieOutResult } from './gl-actions';

type Association = { id: string; name: string };

export type GlImportSectionProps = {
  importChartOfAccounts: (accounts: AppfolioGlAccount[]) => Promise<GlImportSummary>;
};

export type TrialBalanceTieOutSectionProps = {
  associations: Association[];
  tieOutTrialBalance: (
    associationId: string,
    asOf: string,
    rows: TieOutInputRow[],
    options?: TieOutOptions,
  ) => Promise<TieOutResult>;
};

const moneyFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number | null) => (n === null ? '—' : moneyFmt.format(n));
const typeLabel = (t: string | null) => (t ? t.replace(/_/g, ' ') : '—');
const PREVIEW_LIMIT = 100;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function suggestAssociation(name: string, associations: Association[]): string {
  const target = normalize(name);
  if (!target) return associations.length === 1 ? associations[0].id : '';
  const hits = associations.filter((a) => {
    const n = normalize(a.name);
    return n === target || target.startsWith(n) || n.startsWith(target);
  });
  return hits.length === 1 ? hits[0].id : '';
}

function ResultList({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5">
      {items.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
      {items.length > 50 && <li>…and {items.length - 50} more</li>}
    </ul>
  );
}

/* ── Chart of accounts ───────────────────────────────────────────────── */

export function GlImportSection({ importChartOfAccounts }: GlImportSectionProps) {
  const [fileName, setFileName] = React.useState('');
  const [accounts, setAccounts] = React.useState<AppfolioGlAccount[] | null>(null);
  const [rowErrors, setRowErrors] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<GlImportSummary | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setAccounts(null);
    setRowErrors([]);
    setError(null);
    setResult(null);
    setShowAll(false);
    setFileName(file?.name ?? '');
    if (!file) return;
    try {
      const parsed = parseAppfolioChartOfAccounts(await file.text());
      if (parsed.error || !parsed.accounts) { setError(parsed.error ?? 'Could not read the file.'); return; }
      setAccounts(parsed.accounts);
      setRowErrors(parsed.errors ?? []);
    } catch (err) {
      setError(err instanceof Error ? `Could not read the file: ${err.message}` : 'Could not read the file.');
    }
  }

  async function run() {
    if (!accounts?.length) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await importChartOfAccounts(accounts));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The import failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const hidden = accounts?.filter((a) => !a.active).length ?? 0;
  const subAccounts = accounts?.filter((a) => a.parent_number !== null).length ?? 0;
  const shown = accounts ? (showAll ? accounts : accounts.slice(0, PREVIEW_LIMIT)) : [];

  return (
    <div className="space-y-5">
      <Surface className="space-y-5">
        <SectionTitle
          className="mb-0"
          title="Chart of accounts — AppFolio GL Accounts"
          description="In AppFolio open Accounting → GL Accounts and export the list as CSV. Accounts are added to your company-wide chart of accounts. Account numbers you already have are skipped and never changed."
        />
        <Field label="Chart of accounts CSV" htmlFor="appfolio-coa-file" required>
          <Input id="appfolio-coa-file" type="file" accept=".csv,text/csv" required onChange={onFile} className="h-auto py-2" />
        </Field>
        {fileName && <p className="text-xs text-gray-500">{fileName}</p>}
      </Surface>

      {error && <Alert tone="danger">{error}</Alert>}
      {rowErrors.length > 0 && (
        <Alert tone="warning" title={`${rowErrors.length} row${rowErrors.length === 1 ? '' : 's'} cannot be imported.`}>
          <ResultList items={rowErrors} />
        </Alert>
      )}

      {accounts && accounts.length > 0 && (
        <Surface className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">{accounts.length} account{accounts.length === 1 ? '' : 's'}</Badge>
            <Badge tone="info">{subAccounts} sub-account{subAccounts === 1 ? '' : 's'}</Badge>
            {hidden > 0 && <Badge tone="inactive" className="normal-case">{hidden} hidden → inactive</Badge>}
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Number</TH>
                <TH>Account</TH>
                <TH>Type</TH>
                <TH>Sub-account of</TH>
                <TH>Settings</TH>
              </TR>
            </THead>
            <tbody>
              {shown.map((a) => (
                <TR key={a.number}>
                  <TD className="font-medium tabular-nums text-gray-900">{a.number}</TD>
                  <TD>{a.name}</TD>
                  <TD className="whitespace-nowrap">
                    <span className="capitalize">{typeLabel(a.account_type)}</span>
                    {a.appfolio_type && <span className="block text-xs text-gray-400">AppFolio: {a.appfolio_type}</span>}
                  </TD>
                  <TD className="tabular-nums">{a.parent_number ?? '—'}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {!a.active && <Badge tone="inactive">Inactive</Badge>}
                      {a.include_on_cash_flow && <Badge tone="info">Cash flow</Badge>}
                      {a.subject_to_management_fees && <Badge tone="info">Mgmt fees</Badge>}
                      {a.fund_account && <Badge tone="info" className="normal-case">{a.fund_account.replace(/_/g, ' ')} fund</Badge>}
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          {accounts.length > PREVIEW_LIMIT && (
            <Button type="button" variant="ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show fewer' : `Show all ${accounts.length} accounts`}
            </Button>
          )}
          <p className="text-xs text-gray-500">
            Not imported: AppFolio offset accounts, 1099 exclusions, late fee settings and tax authorities (GL accounts here do not store them).
          </p>
          <div>
            <Button type="button" disabled={busy || result !== null} onClick={run}>
              {busy ? 'Importing…' : result ? 'Imported' : `Import ${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
            </Button>
          </div>
          {result && (
            <Alert tone={result.imported > 0 ? 'success' : 'warning'} title={`${result.imported} created, ${result.skipped} skipped.`}>
              <ResultList items={[...(result.errors ?? []), ...(result.notes ?? [])]} />
            </Alert>
          )}
        </Surface>
      )}
    </div>
  );
}

/* ── Trial balance tie-out ───────────────────────────────────────────── */

function statusBadge(l: TieOutLine) {
  if (l.status === 'match') return <Badge tone="complete">Matches</Badge>;
  if (l.status === 'different') return <Badge tone="danger">Different</Badge>;
  if (l.status === 'not_in_portier') return <Badge tone="pending">Not in your ledger</Badge>;
  return <Badge tone="pending">Not in AppFolio</Badge>;
}

export function TrialBalanceTieOutSection({ associations, tieOutTrialBalance }: TrialBalanceTieOutSectionProps) {
  const [fileName, setFileName] = React.useState('');
  const [property, setProperty] = React.useState<string | undefined>();
  const [priorYears, setPriorYears] = React.useState<Record<string, AppfolioTrialBalanceAmounts>>({});
  const [checks, setChecks] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<AppfolioTrialBalanceRow[] | null>(null);
  const [groups, setGroups] = React.useState<string[]>([]);
  const [group, setGroup] = React.useState('');
  const [basis, setBasis] = React.useState<'cash' | 'accrual' | undefined>();
  const [ignored, setIgnored] = React.useState<string[]>([]);
  const [associationId, setAssociationId] = React.useState('');
  const [asOf, setAsOf] = React.useState('');
  const [incomeBasis, setIncomeBasis] = React.useState<'fiscal_year' | 'all_time'>('fiscal_year');
  const [onlyDifferences, setOnlyDifferences] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<TieOutResult | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setRows(null);
    setGroups([]);
    setIgnored([]);
    setBasis(undefined);
    setProperty(undefined);
    setPriorYears({});
    setChecks([]);
    setError(null);
    setResult(null);
    setFileName(file?.name ?? '');
    if (!file) return;
    try {
      const parsed = parseAppfolioTrialBalance(await file.text());
      if (parsed.error || !parsed.rows) { setError(parsed.error ?? 'Could not read the file.'); return; }
      const g = parsed.groups ?? [''];
      setRows(parsed.rows);
      setGroups(g);
      setGroup(g[0] ?? '');
      setBasis(parsed.basis);
      setIgnored(parsed.ignored ?? []);
      setProperty(parsed.property);
      setPriorYears(parsed.priorYearsRetainedEarnings ?? {});
      setChecks(parsed.warnings ?? []);
      if (parsed.asOf) setAsOf(parsed.asOf);
      // A file with no property name and no property groups was most likely
      // run for every property at once: default to all associations combined.
      const unnamed = !parsed.property && g.length === 1 && g[0] === '';
      setAssociationId((current) => current
        || suggestAssociation(g[0] || parsed.property || '', associations)
        || (unnamed && associations.length > 1 ? TIE_OUT_ALL_ASSOCIATIONS : ''));
    } catch (err) {
      setError(err instanceof Error ? `Could not read the file: ${err.message}` : 'Could not read the file.');
    }
  }

  function onGroup(value: string) {
    setGroup(value);
    setResult(null);
    const suggested = suggestAssociation(value, associations);
    if (suggested) setAssociationId(suggested);
  }

  // "All associations combined" compares the whole file: every property group, summed per account.
  const combined = associationId === TIE_OUT_ALL_ASSOCIATIONS;
  const selected = React.useMemo(() => {
    if (!rows) return [];
    if (!combined) return rows.filter((r) => r.group === group);
    const byNumber = new Map<number, { number: number; name: string; ending: number }>();
    for (const r of rows) {
      const cur = byNumber.get(r.number);
      if (cur) cur.ending = Math.round((cur.ending + r.ending) * 100) / 100;
      else byNumber.set(r.number, { number: r.number, name: r.name, ending: r.ending });
    }
    return [...byNumber.values()];
  }, [rows, group, combined]);
  const priorYearsTotal = combined
    ? Object.values(priorYears).reduce<number | null>((sum, p) => (p?.ending == null ? sum : (sum ?? 0) + p.ending), null)
    : priorYears[group]?.ending ?? null;

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await tieOutTrialBalance(
        associationId,
        asOf,
        selected.map((r) => ({ number: r.number, name: r.name, ending: r.ending })),
        { incomeBasis, priorYearsRetainedEarnings: priorYearsTotal },
      );
      if (res.error) setError(res.error);
      else setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The comparison failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const lines = result?.lines ?? [];
  const visible = onlyDifferences ? lines.filter((l) => l.status !== 'match') : lines;
  const t = result?.totals;
  const unnamedFile = rows !== null && !property && groups.length === 1 && groups[0] === '';

  return (
    <div className="space-y-5">
      <Surface className="space-y-5">
        <SectionTitle
          className="mb-0"
          title="Trial balance tie-out"
          description="In AppFolio run Reports → Trial Balance and export it as CSV. This compares each account's ending balance with your posted ledger. It only reads — nothing is saved."
        />
        <Field label="Trial balance CSV" htmlFor="appfolio-tb-file" required>
          <Input id="appfolio-tb-file" type="file" accept=".csv,text/csv" required onChange={onFile} className="h-auto py-2" />
        </Field>
        {fileName && <p className="text-xs text-gray-500">{fileName}{property ? ` · ${property}` : ''}</p>}

        {rows && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {groups.length > 1 && (
              <Field label="AppFolio property in the file" htmlFor="appfolio-tb-group" className="sm:col-span-2">
                <Select id="appfolio-tb-group" value={group} onChange={(e) => onGroup(e.target.value)}>
                  {groups.map((g) => <option key={g} value={g}>{g || '(no property)'}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Compare with" htmlFor="appfolio-tb-assoc" required>
              <Select id="appfolio-tb-assoc" required value={associationId} onChange={(e) => { setAssociationId(e.target.value); setResult(null); }}>
                <option value="">Select an association</option>
                {associations.length > 1 && <option value={TIE_OUT_ALL_ASSOCIATIONS}>All associations combined</option>}
                {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="As of" htmlFor="appfolio-tb-asof" required>
              <Input id="appfolio-tb-asof" type="date" required value={asOf} onChange={(e) => { setAsOf(e.target.value); setResult(null); }} />
            </Field>
            <Field label="Income and expense accounts" htmlFor="appfolio-tb-income" className="sm:col-span-2">
              <Select id="appfolio-tb-income" value={incomeBasis} onChange={(e) => { setIncomeBasis(e.target.value as 'fiscal_year' | 'all_time'); setResult(null); }}>
                <option value="fiscal_year">Fiscal year to date (AppFolio closes prior years to retained earnings)</option>
                <option value="all_time">All time</option>
              </Select>
            </Field>
          </div>
        )}

        {rows && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="button" disabled={!associationId || !asOf || busy || selected.length === 0} onClick={run}>
              {busy ? 'Comparing…' : `Compare ${selected.length} account${selected.length === 1 ? '' : 's'}`}
            </Button>
            {basis && <Badge tone="info" className="normal-case">AppFolio basis: {basis}</Badge>}
          </div>
        )}
      </Surface>

      {unnamedFile && (
        <Alert tone="info" title="This trial balance does not name a property.">
          It was probably run for all properties at once, so its balances are every association combined. Compare it with
          “All associations combined”, or run the report for one property to tie out a single association.
        </Alert>
      )}
      {checks.length > 0 && (
        <Alert tone="warning" title="The file does not balance.">
          <ResultList items={checks} />
        </Alert>
      )}

      {basis === 'cash' && (
        <Alert tone="warning" title="This is a cash-basis trial balance.">
          Your ledger is accrual, so receivable, payable and income balances will differ. Export the trial balance on the accrual basis to tie out.
        </Alert>
      )}
      {ignored.length > 0 && (
        <Alert tone="info" title={`${ignored.length} line${ignored.length === 1 ? ' was' : 's were'} not an account row and ${ignored.length === 1 ? 'was' : 'were'} skipped.`}>
          <ResultList items={ignored} />
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      {result && t && (
        <Surface className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-gray-950">{result.association}</h3>
              <p className="mt-0.5 text-sm text-gray-500">
                As of {result.asOf}
                {result.incomeFrom ? ` · income and expense from ${result.incomeFrom}` : ' · all-time balances'}
                {' · debits positive, credits negative'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="complete" className="normal-case">{t.matched} match</Badge>
              <Badge tone={t.different ? 'danger' : 'inactive'} className="normal-case">{t.different} different</Badge>
              <Badge tone={t.notInPortier ? 'pending' : 'inactive'} className="normal-case">{t.notInPortier} not in your ledger</Badge>
              <Badge tone={t.notInAppfolio ? 'pending' : 'inactive'} className="normal-case">{t.notInAppfolio} not in AppFolio</Badge>
            </div>
          </div>

          {t.different + t.notInPortier + t.notInAppfolio === 0 && (result.priorYears?.difference ?? 0) === 0 && (
            <Alert tone="success" title="Every account ties out.">Your ledger matches AppFolio&apos;s ending balances.</Alert>
          )}
          {result.incomeFrom && !result.priorYears && result.priorYearsNet !== undefined && result.priorYearsNet !== 0 && (
            <Alert tone="info">
              Your ledger has {money(result.priorYearsNet)} of income and expense posted before {result.incomeFrom}. AppFolio
              carries that in retained earnings, so an equity account may differ by that amount.
            </Alert>
          )}

          <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={onlyDifferences} onChange={(e) => setOnlyDifferences(e.target.checked)} className="h-4 w-4 accent-blue-600" />
            Show only accounts that differ
          </label>

          <Table>
            <THead>
              <TR>
                <TH>Account</TH>
                <TH className="text-right">AppFolio</TH>
                <TH className="text-right">Your ledger</TH>
                <TH className="text-right">Difference</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {visible.map((l) => (
                <TR key={l.number}>
                  <TD>
                    <span className="font-medium tabular-nums text-gray-900">{l.number}</span> {l.name}
                    {l.account_type && <span className="block text-xs capitalize text-gray-400">{typeLabel(l.account_type)}</span>}
                  </TD>
                  <TD className="whitespace-nowrap text-right tabular-nums">{money(l.appfolio)}</TD>
                  <TD className="whitespace-nowrap text-right tabular-nums">{money(l.portier)}</TD>
                  <TD className={`whitespace-nowrap text-right tabular-nums ${l.difference !== 0 ? 'font-semibold text-gray-950' : 'text-gray-400'}`}>
                    {money(l.difference)}
                  </TD>
                  <TD>{statusBadge(l)}</TD>
                </TR>
              ))}
              {visible.length === 0 && (
                <TR>
                  <TD colSpan={5} className="py-6 text-center text-gray-500">No differences.</TD>
                </TR>
              )}
              {result.priorYears && (
                <TR>
                  <TD>
                    Prior years&apos; retained earnings
                    <span className="block text-xs text-gray-400">
                      {result.incomeFrom ? `Income and expense before ${result.incomeFrom}` : 'Calculated by AppFolio'}
                    </span>
                  </TD>
                  <TD className="whitespace-nowrap text-right tabular-nums">{money(result.priorYears.appfolio)}</TD>
                  <TD className="whitespace-nowrap text-right tabular-nums">{money(result.priorYears.portier)}</TD>
                  <TD className={`whitespace-nowrap text-right tabular-nums ${result.priorYears.difference !== 0 ? 'font-semibold text-gray-950' : 'text-gray-400'}`}>
                    {money(result.priorYears.difference)}
                  </TD>
                  <TD>{result.priorYears.difference === 0 ? <Badge tone="complete">Matches</Badge> : <Badge tone="danger">Different</Badge>}</TD>
                </TR>
              )}
              <TR>
                <TD className="font-semibold text-gray-950">Total</TD>
                <TD className="whitespace-nowrap text-right font-semibold tabular-nums text-gray-950">{money(t.appfolio)}</TD>
                <TD className="whitespace-nowrap text-right font-semibold tabular-nums text-gray-950">{money(t.portier)}</TD>
                <TD className="whitespace-nowrap text-right font-semibold tabular-nums text-gray-950">{money(t.difference)}</TD>
                <TD />
              </TR>
            </tbody>
          </Table>
        </Surface>
      )}
    </div>
  );
}
