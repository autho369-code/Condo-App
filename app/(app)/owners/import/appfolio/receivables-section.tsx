'use client';

// Reads AppFolio's Aged Receivable Detail export in the browser
// (lib/imports/appfolio-receivables), previews the open items per unit with
// their aging, and imports them as opening-balance charges into the chosen
// association. The server action re-validates everything; this only previews.
import * as React from 'react';
import { Alert, Badge, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import {
  parseAppfolioAgedReceivables,
  type AppfolioReceivablesParse,
} from '@/lib/imports/appfolio-receivables';
import type { ReceivableImportItem, ReceivablesImportSummary } from './receivables-actions';

type Association = {
  id: string;
  name: string;
  /** The association's unit numbers, when the page provides them: the preview then shows which units match. */
  unitNumbers?: string[];
};

type Props = {
  associations: Association[];
  importReceivables: (
    associationId: string,
    asOf: string,
    items: ReceivableImportItem[],
    options?: { confirmDuplicate?: boolean },
  ) => Promise<ReceivablesImportSummary>;
};

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ReceivablesImportSection({ associations, importReceivables }: Props) {
  const fileId = React.useId();
  const assocId = React.useId();
  const asOfId = React.useId();
  const [parsed, setParsed] = React.useState<AppfolioReceivablesParse | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState('');
  const [associationId, setAssociationId] = React.useState('');
  const [asOf, setAsOf] = React.useState(todayLocal);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ReceivablesImportSummary | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);

  const association = associations.find((a) => a.id === associationId);
  const knownUnits = React.useMemo(
    () => (association?.unitNumbers ? new Set(association.unitNumbers.map((u) => u.trim().toLowerCase())) : null),
    [association],
  );
  const units = parsed?.units ?? [];
  const totals = parsed?.totals;
  const chargeCount = parsed?.items?.filter((i) => i.amount > 0).length ?? 0;
  const creditItems = parsed?.items?.filter((i) => i.amount < 0) ?? [];
  const unmatchedCount = knownUnits ? units.filter((u) => !knownUnits.has(u.unit_number.toLowerCase())).length : 0;
  const done = result !== null && result.alreadyImported === undefined;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setParsed(null);
    setParseError(null);
    setResult(null);
    setFailure(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const p = parseAppfolioAgedReceivables(await file.text());
      if (p.error || !p.units) { setParseError(p.error ?? 'Could not read the file.'); return; }
      setParsed(p);
    } catch {
      setParseError('Could not read the file. Export it from AppFolio again as CSV and retry.');
    }
  }

  async function run(confirmDuplicate = false) {
    if (!parsed?.items) return;
    setBusy(true);
    setFailure(null);
    setResult(null);
    try {
      const items: ReceivableImportItem[] = parsed.items.map((i) => ({
        row: i.row, unit_number: i.unit_number, charge_date: i.charge_date, gl_name: i.gl_name, amount: i.amount,
      }));
      setResult(await importReceivables(associationId, asOf, items, { confirmDuplicate }));
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The import failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Surface className="space-y-4">
        <div>
          <h2 className="text-[15px] font-semibold text-gray-950">Opening balances — AppFolio Aged Receivable Detail</h2>
          <p className="mt-1 text-sm text-gray-600">
            Run the Aged Receivable Detail report in AppFolio for one association, as of your cut-over date, grouped by
            unit and payer (or with the Unit Name column added), and export it as CSV. Each open charge becomes an
            opening-balance charge on its unit, dated with its original charge date.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor={fileId}>Aged Receivable Detail CSV</Label>
            <Input id={fileId} type="file" accept=".csv,text/csv" onChange={onFile} className="h-auto py-2" />
          </div>
          <div>
            <Label htmlFor={assocId}>Import into</Label>
            <Select
              id={assocId}
              value={associationId}
              onChange={(e) => { setAssociationId(e.target.value); setResult(null); }}
              required
            >
              <option value="">Select an association</option>
              {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor={asOfId}>Report as-of date</Label>
            <Input id={asOfId} type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} required />
          </div>
        </div>
        {fileName && parsed && <p className="text-xs text-gray-500">{fileName}</p>}
      </Surface>

      {parseError && <Alert tone="danger">{parseError}</Alert>}

      {parsed && totals && (
        <Surface className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">{plural(units.length, 'unit')}</Badge>
            <Badge tone="info">{plural(totals.itemCount, 'open item')}</Badge>
            <Badge tone="open">Receivable {usd(totals.amount)}</Badge>
            {creditItems.length > 0 && <Badge tone="pending">{plural(creditItems.length, 'credit')} ({usd(totals.credits)})</Badge>}
            {knownUnits && (unmatchedCount
              ? <Badge tone="danger">{plural(unmatchedCount, 'unit')} not in this association</Badge>
              : <Badge tone="complete">All units match</Badge>)}
          </div>

          {creditItems.length > 0 && (
            <Alert tone="warning" title="Credits are not imported.">
              Charges can&apos;t be negative here, so the {plural(creditItems.length, 'credit')} in this file
              ({usd(totals.credits)}) will be listed after the import for you to enter as credits on those units.
            </Alert>
          )}
          {parsed.problems?.length ? (
            <Alert tone="warning" title={`${plural(parsed.problems.length, 'row')} could not be read and will be left out.`}>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {parsed.problems.slice(0, 20).map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </Alert>
          ) : null}

          <Table>
            <THead>
              <TR>
                <TH>Unit</TH>
                <TH className="text-right">0-30</TH>
                <TH className="text-right">31-60</TH>
                <TH className="text-right">61-90</TH>
                <TH className="text-right">91+</TH>
                <TH className="text-right">Receivable</TH>
                <TH>Match</TH>
              </TR>
            </THead>
            <tbody>
              {units.map((u) => {
                const matched = knownUnits ? knownUnits.has(u.unit_number.toLowerCase()) : null;
                return (
                  <TR key={u.unit_number}>
                    <TD>
                      <div className="font-medium text-gray-900">{u.unit_number}</div>
                      <div className="text-xs text-gray-500">
                        {u.payers.join(', ') || '—'} · {plural(u.items.length, 'item')}
                      </div>
                    </TD>
                    <TD className="text-right tabular-nums">{usd(u.aging.d0_30)}</TD>
                    <TD className="text-right tabular-nums">{usd(u.aging.d31_60)}</TD>
                    <TD className="text-right tabular-nums">{usd(u.aging.d61_90)}</TD>
                    <TD className="text-right tabular-nums">{usd(u.aging.d91_plus)}</TD>
                    <TD className="text-right font-medium tabular-nums text-gray-900">{usd(u.total)}</TD>
                    <TD>
                      {matched === null
                        ? <span className="text-xs text-gray-400">Choose an association</span>
                        : matched
                          ? <Badge tone="complete">Matched</Badge>
                          : <Badge tone="danger">Not found</Badge>}
                    </TD>
                  </TR>
                );
              })}
              <TR>
                <TD className="font-semibold text-gray-950">Total</TD>
                <TD className="text-right font-semibold tabular-nums text-gray-950">{usd(totals.aging.d0_30)}</TD>
                <TD className="text-right font-semibold tabular-nums text-gray-950">{usd(totals.aging.d31_60)}</TD>
                <TD className="text-right font-semibold tabular-nums text-gray-950">{usd(totals.aging.d61_90)}</TD>
                <TD className="text-right font-semibold tabular-nums text-gray-950">{usd(totals.aging.d91_plus)}</TD>
                <TD className="text-right font-semibold tabular-nums text-gray-950">{usd(totals.amount)}</TD>
                <TD />
              </TR>
            </tbody>
          </Table>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              className="h-10"
              disabled={!associationId || !asOf || busy || done || chargeCount === 0}
              onClick={() => run(false)}
            >
              {busy ? 'Importing…' : done ? 'Imported' : `Import ${plural(chargeCount, 'charge')} (${usd(totals.charges)})`}
            </Button>
            {knownUnits && unmatchedCount > 0 && (
              <p className="text-sm text-gray-500">Items on units not in this association are skipped and listed after the import.</p>
            )}
          </div>

          {failure && <Alert tone="danger">{failure}</Alert>}
          {result?.alreadyImported !== undefined && (
            <Alert tone="warning" title="This association already has AppFolio opening balances.">
              <p>{result.errors?.[0]}</p>
              <Button type="button" variant="secondary" className="mt-3 h-10" disabled={busy} onClick={() => run(true)}>
                Import anyway
              </Button>
            </Alert>
          )}
          {done && result && (
            <Alert
              tone={result.imported > 0 ? 'success' : 'warning'}
              title={`${plural(result.imported, 'charge')} imported (${usd(result.totalImported)}), ${result.skipped} skipped.`}
            >
              {result.errors?.length ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {result.errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              ) : null}
              {(result.errors?.length ?? 0) > 50 && <p className="mt-1">…and {result.errors!.length - 50} more.</p>}
            </Alert>
          )}
        </Surface>
      )}
    </div>
  );
}
