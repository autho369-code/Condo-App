'use client';

// Reads AppFolio's Homeowner Directory export in the browser
// (lib/imports/appfolio-homeowners), shows each AppFolio association it found
// with its current homeowners, and imports one association at a time into the
// association the user picks. The server action re-validates everything; this
// only previews.
import * as React from 'react';
import { Alert, Badge, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import {
  ownershipTotal,
  parseAppfolioHomeownerDirectory,
  type AppfolioHomeownerGroup,
} from '@/lib/imports/appfolio-homeowners';
import type { ImportSummary } from '../actions';
import type { HomeownerImportRow } from './homeowner-actions';

type Association = { id: string; name: string };

type Props = {
  associations: Association[];
  importHomeowners: (associationId: string, rows: HomeownerImportRow[]) => Promise<ImportSummary>;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The association whose name matches the AppFolio one, if exactly one does. */
function suggestAssociation(name: string, associations: Association[]): string {
  const target = normalize(name);
  if (!target) return '';
  const hits = associations.filter((a) => {
    const n = normalize(a.name);
    return n === target || target.startsWith(n) || n.startsWith(target);
  });
  return hits.length === 1 ? hits[0].id : '';
}

function GroupCard({ group, associations, importHomeowners }: { group: AppfolioHomeownerGroup } & Props) {
  const selectId = React.useId();
  const [associationId, setAssociationId] = React.useState(() => suggestAssociation(group.name, associations));
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ImportSummary | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const owners = group.homeowners;
  const ownership = ownershipTotal(owners);
  const noEmail = owners.filter((h) => h.emails.length === 0).length;
  const unitCount = new Set(owners.map((h) => h.unit_number.toLowerCase())).size;

  async function run() {
    setBusy(true);
    setFailure(null);
    setResult(null);
    try {
      const rows: HomeownerImportRow[] = owners.map((h) => ({
        row: h.row,
        unit_number: h.unit_number,
        raw_name: h.name.raw,
        electronic_consent: h.electronic_consent,
        phones: h.phones,
        emails: h.emails,
        ownership_pct: h.ownership_pct,
        dues: h.dues,
      }));
      setResult(await importHomeowners(associationId, rows));
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The import failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-gray-950">{group.name || 'Homeowners'}</h3>
        {group.address && <p className="mt-0.5 text-sm text-gray-500">{group.address}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="info">{plural(owners.length, 'homeowner')}</Badge>
          <Badge tone="info">{plural(unitCount, 'unit')}</Badge>
          {ownership.units > 0
            ? <Badge tone={Math.abs(ownership.total - 100) <= 0.01 ? 'complete' : 'pending'}>Ownership {ownership.total}%</Badge>
            : <Badge tone="inactive" className="normal-case">No ownership %</Badge>}
          {noEmail > 0 && <Badge tone="pending" className="normal-case">{noEmail} without email</Badge>}
          {group.skipped.length > 0 && <Badge tone="inactive" className="normal-case">{group.skipped.length} not current</Badge>}
        </div>
      </div>

      {group.skipped.length > 0 && (
        <Alert tone="info" title={`${plural(group.skipped.length, 'row')} will not be imported.`}>
          Only current homeowners are imported.
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {group.skipped.slice(0, 10).map((s) => (
              <li key={s.row}>Line {s.row}: {s.unit_number || 'no unit'} / {s.name || 'no name'} ({s.reason})</li>
            ))}
          </ul>
          {group.skipped.length > 10 && <p className="mt-1">…and {group.skipped.length - 10} more.</p>}
        </Alert>
      )}

      {owners.length > 0 && (
        <Table>
          <THead>
            <TR>
              <TH>Unit</TH>
              <TH>Homeowner</TH>
              <TH>Contact</TH>
              <TH className="text-right">Ownership %</TH>
              <TH className="text-right">Dues</TH>
            </TR>
          </THead>
          <tbody>
            {owners.map((h) => (
              <TR key={h.row}>
                <TD className="font-medium text-gray-900">{h.unit_number}</TD>
                <TD>
                  <div className="text-gray-900">{h.name.display}</div>
                  {h.name.raw !== h.name.display && <div className="text-xs text-gray-500">AppFolio: {h.name.raw}</div>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {h.name.is_company && <Badge tone="info" className="normal-case">Company or trust</Badge>}
                    {h.name.notes.map((n) => <Badge key={n} tone="inactive" className="normal-case">{n}</Badge>)}
                    {h.electronic_consent && <Badge tone="complete" className="normal-case">E-delivery consent</Badge>}
                  </div>
                </TD>
                <TD>
                  <div>{h.emails[0] ?? '—'}{h.emails.length > 1 ? ` +${h.emails.length - 1}` : ''}</div>
                  {h.phones && <div className="text-xs text-gray-500">{h.phones}</div>}
                </TD>
                <TD className="text-right tabular-nums">{h.ownership_pct ?? '—'}</TD>
                <TD className="text-right tabular-nums">{h.dues !== null ? usd(h.dues) : '—'}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor={selectId}>Import into</Label>
          <Select id={selectId} value={associationId} onChange={(e) => { setAssociationId(e.target.value); setResult(null); }} required>
            <option value="">Select an association</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={!associationId || busy || result !== null || owners.length === 0}
          onClick={run}
        >
          {busy ? 'Importing…' : result ? 'Imported' : `Import ${plural(owners.length, 'homeowner')}`}
        </Button>
      </div>

      {failure && <Alert tone="danger">{failure}</Alert>}
      {result && (
        <Alert tone={result.imported > 0 ? 'success' : 'warning'} title={`${result.imported} linked, ${result.skipped} skipped.`}>
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

export function HomeownerImportSection({ associations, importHomeowners }: Props) {
  const fileId = React.useId();
  const [groups, setGroups] = React.useState<AppfolioHomeownerGroup[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState('');

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setGroups(null);
    setError(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const parsed = parseAppfolioHomeownerDirectory(await file.text());
      if (parsed.error || !parsed.groups) { setError(parsed.error ?? 'Could not read the file.'); return; }
      setGroups(parsed.groups);
    } catch {
      setError('Could not read the file. Export it from AppFolio again as CSV and retry.');
    }
  }

  return (
    <div className="space-y-5">
      <Surface className="space-y-3">
        <SectionTitle
          className="mb-0"
          title="Homeowners — AppFolio Homeowner Directory"
          description="In AppFolio open Reports → Homeowner Directory, then Actions → Export as CSV. Import units first: homeowners are linked to existing units by unit number. Importing again skips homeowners already on a unit."
        />
        <div>
          <Label htmlFor={fileId}>Homeowner Directory CSV</Label>
          <Input id={fileId} type="file" accept=".csv,text/csv" onChange={onFile} className="h-auto py-2" />
        </div>
        {fileName && !error && groups && <p className="text-xs text-gray-500">{fileName}</p>}
      </Surface>

      {error && <Alert tone="danger">{error}</Alert>}
      {groups?.map((g) => (
        <GroupCard key={`${g.name}|${g.address ?? ''}`} group={g} associations={associations} importHomeowners={importHomeowners} />
      ))}
    </div>
  );
}
