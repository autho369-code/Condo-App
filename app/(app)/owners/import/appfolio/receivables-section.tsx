'use client';

// Reads AppFolio's Aged Receivable Detail export in the browser
// (lib/imports/appfolio-receivables). A company-wide export covers many
// associations: each AppFolio association gets its own card with its open
// items per unit, a name-matched suggestion for the target association, and
// its own Import button, so one association is imported at a time. The server
// action re-validates everything; this only previews.
import * as React from 'react';
import { Alert, Badge, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import {
  parseAppfolioAgedReceivables,
  type AppfolioReceivableAssociation,
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
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/** Same comparison the server action uses: case-insensitive, spacing around dashes ignored. */
const unitKey = (v: string) => v.trim().toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');

/** The association whose name matches the AppFolio one, if exactly one does. */
function suggestAssociation(name: string, associations: Association[]): string {
  const target = normalize(name);
  if (!target) return associations.length === 1 ? associations[0].id : '';
  const hits = associations.filter((a) => {
    const n = normalize(a.name);
    return n !== '' && (n === target || target.startsWith(n) || n.startsWith(target));
  });
  return hits.length === 1 ? hits[0].id : '';
}

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** AppFolio names exports "aged_receivable_detail-YYYYMMDD.csv": that date is the report's as-of date. */
function asOfFromFileName(name: string): string | null {
  const m = name.match(/(20\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function AssociationCard({
  group,
  asOf,
  associations,
  importReceivables,
}: {
  group: AppfolioReceivableAssociation;
  asOf: string;
  associations: Association[];
  importReceivables: Props['importReceivables'];
}) {
  const selectId = React.useId();
  const [associationId, setAssociationId] = React.useState(() => suggestAssociation(group.name, associations));
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ReceivablesImportSummary | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);

  const association = associations.find((a) => a.id === associationId);
  const knownUnits = React.useMemo(
    () => (association?.unitNumbers ? new Set(association.unitNumbers.map(unitKey)) : null),
    [association],
  );
  const { units, totals } = group;
  const chargeCount = group.items.filter((i) => i.amount > 0).length;
  const creditItems = group.items.filter((i) => i.amount < 0);
  const unmatchedCount = knownUnits ? units.filter((u) => !knownUnits.has(unitKey(u.unit_number))).length : 0;
  const done = result !== null && result.alreadyImported === undefined;

  async function run(confirmDuplicate = false) {
    setBusy(true);
    setFailure(null);
    setResult(null);
    try {
      const items: ReceivableImportItem[] = group.items.map((i) => ({
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
    <Surface className="space-y-4">
      <div>
        <SectionTitle title={group.name || 'Open receivables'} description={group.address ?? undefined} className="mb-0" />
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="info">{plural(units.length, 'unit')}</Badge>
          <Badge tone="info">{plural(totals.itemCount, 'open item')}</Badge>
          <Badge tone="info" className="normal-case">Receivable {usd(totals.amount)}</Badge>
          {creditItems.length > 0 && (
            <Badge tone="pending" className="normal-case">{plural(creditItems.length, 'credit')} ({usd(totals.credits)})</Badge>
          )}
          {knownUnits && (unmatchedCount
            ? <Badge tone="danger">{plural(unmatchedCount, 'unit')} not in this association</Badge>
            : <Badge tone="complete">All units match</Badge>)}
        </div>
      </div>

      {creditItems.length > 0 && (
        <Alert tone="warning" title="Credits are not imported.">
          Charges can&apos;t be negative here, so the {plural(creditItems.length, 'credit')} for this association
          ({usd(totals.credits)}) will be listed after the import for you to enter as credits on those units.
        </Alert>
      )}

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
            const matched = knownUnits ? knownUnits.has(unitKey(u.unit_number)) : null;
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor={selectId}>Import into</Label>
          <Select
            id={selectId}
            value={associationId}
            onChange={(e) => { setAssociationId(e.target.value); setResult(null); }}
            required
          >
            <option value="">Select an association</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        <Button
          type="button"
          disabled={!associationId || !asOf || busy || done || chargeCount === 0}
          onClick={() => run(false)}
        >
          {busy ? 'Importing…' : done ? 'Imported' : `Import ${plural(chargeCount, 'charge')} (${usd(totals.charges)})`}
        </Button>
      </div>
      {knownUnits && unmatchedCount > 0 && (
        <p className="text-sm text-gray-500">Items on units not in this association are skipped and listed after the import.</p>
      )}

      {failure && <Alert tone="danger">{failure}</Alert>}
      {result?.alreadyImported !== undefined && (
        <Alert tone="warning" title="This association already has AppFolio opening balances.">
          <p>{result.errors?.[0]}</p>
          <Button type="button" variant="secondary" className="mt-3" disabled={busy} onClick={() => run(true)}>
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
  );
}

export function ReceivablesImportSection({ associations, importReceivables }: Props) {
  const fileId = React.useId();
  const asOfId = React.useId();
  const [parsed, setParsed] = React.useState<AppfolioReceivablesParse | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState('');
  const [fileKey, setFileKey] = React.useState(0);
  const [asOf, setAsOf] = React.useState(todayLocal);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setParsed(null);
    setParseError(null);
    if (!file) return;
    setFileName(file.name);
    setFileKey((k) => k + 1);
    const fromName = asOfFromFileName(file.name);
    if (fromName) setAsOf(fromName);
    try {
      const p = parseAppfolioAgedReceivables(await file.text());
      if (p.error || !p.associations) { setParseError(p.error ?? 'Could not read the file.'); return; }
      setParsed(p);
    } catch {
      setParseError('Could not read the file. Export it from AppFolio again as CSV and retry.');
    }
  }

  const totals = parsed?.totals;
  const groups = parsed?.associations ?? [];
  const tiesOut = parsed?.fileTotal == null || (totals && Math.abs(parsed.fileTotal - totals.amount) < 0.005);

  return (
    <div className="space-y-5">
      <Surface className="space-y-4">
        <SectionTitle
          title="Opening balances — AppFolio Aged Receivable Detail"
          description="Run the Aged Receivable Detail report in AppFolio as of your cut-over date, for one association or the whole company, grouped by property, unit and payer, and export it as CSV. Each open charge becomes an opening-balance charge on its unit, dated with the report's as-of date; the original charge date is kept in its description."
          className="mb-0"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor={fileId}>Aged Receivable Detail CSV</Label>
            <Input id={fileId} type="file" accept=".csv,text/csv" onChange={onFile} className="h-auto py-2" />
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
        <Surface className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">{plural(groups.length, 'association')}</Badge>
            <Badge tone="info">{plural(groups.reduce((s, g) => s + g.units.length, 0), 'unit')}</Badge>
            <Badge tone="info">{plural(totals.itemCount, 'open item')}</Badge>
            <Badge tone="info" className="normal-case">Receivable {usd(totals.amount)}</Badge>
            {totals.credits < 0 && <Badge tone="pending" className="normal-case">Credits {usd(totals.credits)}</Badge>}
            {parsed.fileTotal != null && (tiesOut
              ? <Badge tone="complete" className="normal-case">Ties to file total {usd(parsed.fileTotal)}</Badge>
              : <Badge tone="danger" className="normal-case">File total {usd(parsed.fileTotal)} differs</Badge>)}
          </div>
          {!tiesOut && (
            <Alert tone="warning" title="The items read don't add up to the file's Total line.">
              Some rows may not have been read. Check the rows listed below, or export the report again as CSV.
            </Alert>
          )}
          {parsed.problems?.length ? (
            <Alert tone="warning" title={`${plural(parsed.problems.length, 'row')} could not be read and will be left out.`}>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {parsed.problems.slice(0, 20).map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </Alert>
          ) : null}
          <p className="text-sm text-gray-600">
            Pick the association each one goes into and import them one at a time.
          </p>
        </Surface>
      )}

      {groups.map((g) => (
        <AssociationCard
          key={`${fileKey}-${g.name}|${g.address ?? ""}`}
          group={g}
          asOf={asOf}
          associations={associations}
          importReceivables={importReceivables}
        />
      ))}
    </div>
  );
}
