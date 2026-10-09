'use client';

// Reads AppFolio's Unit Directory export in the browser (lib/imports/appfolio),
// shows each AppFolio association it found with its units, and imports one
// association at a time into the Portier369 association the user picks. The
// server action re-validates everything; this only previews.
import * as React from 'react';
import { Alert, Badge, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { parseAppfolioUnitDirectory, type AppfolioUnit } from '@/lib/imports/appfolio';
import type { AppfolioUnitRow, ImportSummary } from '../actions';
import { GroupPicker } from './group-picker';

type Association = { id: string; name: string };
type Group = { name: string; address: string | null; units: AppfolioUnit[] };

type Props = {
  associations: Association[];
  importUnits: (associationId: string, units: AppfolioUnitRow[]) => Promise<ImportSummary>;
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The Portier369 association whose name matches the AppFolio one, if exactly one does. */
function suggestAssociation(name: string, associations: Association[]): string {
  const target = normalize(name);
  if (!target) return '';
  const hits = associations.filter((a) => {
    const n = normalize(a.name);
    return n === target || target.startsWith(n) || n.startsWith(target);
  });
  return hits.length === 1 ? hits[0].id : '';
}

function GroupCard({ group, associations, importUnits }: { group: Group; associations: Association[]; importUnits: Props['importUnits'] }) {
  const selectId = React.useId();
  const [associationId, setAssociationId] = React.useState(() => suggestAssociation(group.name, associations));
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ImportSummary | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const totalPct = group.units.reduce((s, u) => s + (u.ownership_pct ?? 0), 0);
  const withPct = group.units.filter((u) => u.ownership_pct !== null).length;

  async function run() {
    setBusy(true);
    setFailure(null);
    setResult(null);
    try {
      setResult(await importUnits(associationId, group.units.map((u) => ({ ...u }))));
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The import failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-gray-950">{group.name || 'Units'}</h3>
        {group.address && <p className="mt-0.5 text-sm text-gray-500">{group.address}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="info">{group.units.length} unit{group.units.length === 1 ? '' : 's'}</Badge>
          {withPct > 0
            ? <Badge tone={Math.abs(totalPct - 100) <= 0.01 ? 'complete' : 'pending'}>Ownership {Math.round(totalPct * 10000) / 10000}%</Badge>
            : <Badge tone="pending" className="normal-case">No ownership %</Badge>}
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Unit</TH>
            <TH className="text-right">Ownership %</TH>
            <TH className="text-right">Sqft</TH>
            <TH className="text-right">Beds</TH>
            <TH className="text-right">Baths</TH>
            <TH>Unit address</TH>
          </TR>
        </THead>
        <tbody>
          {group.units.map((u) => (
            <TR key={`${u.row}-${u.unit_number}`}>
              <TD className="font-medium text-gray-900">{u.unit_number}</TD>
              <TD className="text-right">{u.ownership_pct ?? '—'}</TD>
              <TD className="text-right">{u.sqft ?? '—'}</TD>
              <TD className="text-right">{u.bedrooms ?? '—'}</TD>
              <TD className="text-right">{u.bathrooms ?? '—'}</TD>
              <TD>{u.address ?? '—'}</TD>
            </TR>
          ))}
        </tbody>
      </Table>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor={selectId}>Import into</Label>
          <Select id={selectId} value={associationId} onChange={(e) => setAssociationId(e.target.value)} required>
            <option value="">Select an association</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        <Button type="button" disabled={!associationId || busy || result !== null} onClick={run}>
          {busy ? 'Importing…' : result ? 'Imported' : `Import ${group.units.length} unit${group.units.length === 1 ? '' : 's'}`}
        </Button>
      </div>

      {failure && <Alert tone="danger">{failure}</Alert>}
      {result && (
        <Alert tone={result.imported > 0 ? 'success' : 'warning'} title={`${result.imported} created, ${result.skipped} skipped.`}>
          {result.errors?.length ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {result.errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          ) : null}
        </Alert>
      )}
    </Surface>
  );
}

export function AppfolioImportClient({ associations, importUnits }: Props) {
  const [groups, setGroups] = React.useState<Group[] | null>(null);
  const [hasOwnership, setHasOwnership] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState('');

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setGroups(null);
    setError(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const parsed = parseAppfolioUnitDirectory(await file.text());
      if (parsed.error || !parsed.groups) { setError(parsed.error ?? 'Could not read the file.'); return; }
      setHasOwnership(Boolean(parsed.hasOwnership));
      setGroups(parsed.groups);
    } catch {
      setError('Could not read the file. Export it from your previous system again as CSV and retry.');
    }
  }

  return (
    <div className="space-y-5">
      <Surface className="space-y-3">
        <SectionTitle
          className="mb-0"
          title="Units — Unit Directory"
          description="In your previous system, open Reports → Unit Directory (add the unit address columns under Customize if units have their own addresses), then Actions → Export as CSV."
        />
        <div>
          <Label htmlFor="appfolio-unit-directory">Unit Directory CSV</Label>
          <Input id="appfolio-unit-directory" type="file" accept=".csv,text/csv" onChange={onFile} className="h-auto py-2" />
        </div>
        {fileName && !error && groups && <p className="text-xs text-gray-500">{fileName}</p>}
      </Surface>

      {error && <Alert tone="danger">{error}</Alert>}
      {groups && !hasOwnership && (
        <Alert tone="info" title="This export has no ownership percentage column.">
          Units are created at 0% ownership. The homeowner import below fills each unit&apos;s ownership percentage
          from the Homeowner Directory export.
        </Alert>
      )}
      {groups && (
        <GroupPicker groups={groups} render={(g) => (
          <GroupCard key={`${g.name}|${g.address ?? ''}`} group={g} associations={associations} importUnits={importUnits} />
        )} />
      )}
    </div>
  );
}
