'use client';

// Reads AppFolio's Work Order report in the browser
// (lib/imports/appfolio-work-orders), shows each AppFolio property it found
// with a preview of its work orders and any status/priority that had to fall
// back to a default, and imports one property at a time into the Portier369
// association the user picks. The server action re-validates everything.
import * as React from 'react';
import { Alert, Badge, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import {
  parseAppfolioWorkOrders,
  WORK_ORDER_STATUSES,
  type AppfolioWorkOrder,
  type AppfolioWorkOrderGroup,
} from '@/lib/imports/appfolio-work-orders';
import type { WorkOrderImportSummary } from './work-order-actions';

type Association = { id: string; name: string };

type Props = {
  associations: Association[];
  importWorkOrders: (associationId: string, workOrders: AppfolioWorkOrder[]) => Promise<WorkOrderImportSummary>;
};

const PREVIEW_ROWS = 50;
const WARNINGS_SHOWN = 20;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Work orders per request, and bytes per request (well under the 12 MB server-action limit). */
const BATCH_SIZE = 200;
const BATCH_BYTES = 4_000_000;
/** The server keeps at most 20,000 characters of any text field; trim before sending. */
const MAX_FIELD = 20_000;

/** Split into requests of at most BATCH_SIZE rows and BATCH_BYTES of JSON, long text trimmed. */
function batchesOf(rows: AppfolioWorkOrder[]): AppfolioWorkOrder[][] {
  const encoder = new TextEncoder();
  const out: AppfolioWorkOrder[][] = [];
  let current: AppfolioWorkOrder[] = [];
  let bytes = 0;
  for (const row of rows) {
    const trimmed = Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, MAX_FIELD) : v]),
    ) as AppfolioWorkOrder;
    const size = encoder.encode(JSON.stringify(trimmed)).length;
    if (current.length && (current.length >= BATCH_SIZE || bytes + size > BATCH_BYTES)) {
      out.push(current);
      current = [];
      bytes = 0;
    }
    current.push(trimmed);
    bytes += size;
  }
  if (current.length) out.push(current);
  return out;
}

/** The association whose name matches the AppFolio property, if exactly one does. */

function suggestAssociation(name: string, associations: Association[]): string {
  const target = normalize(name);
  if (!target) return '';
  const hits = associations.filter((a) => {
    const n = normalize(a.name);
    return n === target || target.startsWith(n) || n.startsWith(target);
  });
  return hits.length === 1 ? hits[0].id : '';
}

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

function GroupCard({ group, associations, importWorkOrders }: { group: AppfolioWorkOrderGroup; associations: Association[]; importWorkOrders: Props['importWorkOrders'] }) {
  const selectId = React.useId();
  const [associationId, setAssociationId] = React.useState(() => suggestAssociation(group.name, associations));
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<WorkOrderImportSummary | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const count = group.workOrders.length;
  const byStatus = WORK_ORDER_STATUSES
    .map((s) => [s, group.workOrders.filter((w) => w.status === s).length] as const)
    .filter(([, n]) => n > 0);

  async function run() {
    setBusy(true);
    setFailure(null);
    setResult(null);
    try {
      // Send in batches so each request stays well under the server-action body limit
      // (12 MB); the server skips work orders an earlier batch already created.
      const total: WorkOrderImportSummary = { imported: 0, skipped: 0, errors: [] };
      for (const batch of batchesOf(group.workOrders)) {
        const part = await importWorkOrders(associationId, batch);
        total.imported += part.imported;
        total.skipped += part.skipped;
        total.errors!.push(...(part.errors ?? []));
      }
      setResult({ ...total, errors: total.errors!.length ? total.errors : undefined });
    } catch (e) {
      setFailure(e instanceof Error ? e.message : 'The import failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface className="space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-gray-950">{group.name || 'Work orders'}</h3>
        {group.address && <p className="mt-0.5 text-sm text-gray-500">{group.address}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone="info" className="normal-case">{plural(count, 'work order')}</Badge>
          {byStatus.map(([s, n]) => <Badge key={s} status={s} className="normal-case">{`${s.replace(/_/g, ' ')} ${n.toLocaleString()}`}</Badge>)}
        </div>
      </div>

      {group.warnings.length > 0 && (
        <Alert tone="warning" title={`${plural(group.warnings.length, 'row')} need${group.warnings.length === 1 ? 's' : ''} a look`}>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {group.warnings.slice(0, WARNINGS_SHOWN).map((w, i) => <li key={i}>{w}</li>)}
          </ul>
          {group.warnings.length > WARNINGS_SHOWN && (
            <p className="mt-1">and {(group.warnings.length - WARNINGS_SHOWN).toLocaleString()} more.</p>
          )}
        </Alert>
      )}

      <Table>
        <THead>
          <TR>
            <TH>WO #</TH>
            <TH>Work order</TH>
            <TH>Status</TH>
            <TH>Priority</TH>
            <TH>Unit</TH>
            <TH>Vendor</TH>
            <TH>Created</TH>
          </TR>
        </THead>
        <tbody>
          {group.workOrders.slice(0, PREVIEW_ROWS).map((w) => (
            <TR key={`${w.row}-${w.number}`}>
              <TD className="whitespace-nowrap font-medium tabular-nums text-gray-900">{w.number}</TD>
              <TD className="min-w-[14rem]">
                <div className="max-w-xs truncate text-gray-900">{w.issue || w.job_description || '—'}</div>
                {w.issue && w.job_description && <div className="max-w-xs truncate text-xs text-gray-500">{w.job_description}</div>}
              </TD>
              <TD className="whitespace-nowrap">
                <Badge status={w.status} />
                {w.appfolio_status && <div className="mt-0.5 text-xs text-gray-500">AppFolio: {w.appfolio_status}</div>}
              </TD>
              <TD className="whitespace-nowrap capitalize">{w.priority}</TD>
              <TD className="whitespace-nowrap">{w.unit ?? '—'}</TD>
              <TD className="whitespace-nowrap">{w.vendor ?? '—'}</TD>
              <TD className="whitespace-nowrap tabular-nums">{w.created_on ?? '—'}</TD>
            </TR>
          ))}
        </tbody>
      </Table>
      {count > PREVIEW_ROWS && (
        <p className="text-xs text-gray-500">Showing the first {PREVIEW_ROWS} of {count.toLocaleString()} work orders.</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor={selectId}>Import into</Label>
          <Select id={selectId} value={associationId} onChange={(e) => setAssociationId(e.target.value)} required>
            <option value="">Select an association</option>
            {associations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </div>
        <Button type="button" disabled={!associationId || busy || result !== null || count === 0} onClick={run}>
          {busy ? 'Importing…' : result ? 'Imported' : `Import ${plural(count, 'work order')}`}
        </Button>
      </div>

      {failure && <Alert tone="danger">{failure}</Alert>}
      {result && (
        <Alert tone={result.imported > 0 ? 'success' : 'warning'} title={`${result.imported.toLocaleString()} created, ${result.skipped.toLocaleString()} skipped.`}>
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

export function WorkOrderImportSection({ associations, importWorkOrders }: Props) {
  const inputId = React.useId();
  const [groups, setGroups] = React.useState<AppfolioWorkOrderGroup[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState('');

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setGroups(null);
    setError(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const parsed = parseAppfolioWorkOrders(await file.text());
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
          title="Work orders — AppFolio Work Order report"
          description={
            <>
              In AppFolio open Reports → Work Order, set the date range to cover all history, group rows by Property,
              then Actions → Export as CSV. Import units and vendors first so work orders can be matched to them.
              Each work order keeps its AppFolio number at the start of its description; importing the same file
              again skips the ones already imported. Imported work orders send no emails. If your company has a
              webhook subscribed to new work orders, each imported work order is announced to it.
            </>
          }
          className="mb-0"
        />
        <div>
          <Label htmlFor={inputId}>Work Order CSV</Label>
          <Input id={inputId} type="file" accept=".csv,text/csv" onChange={onFile} className="h-auto py-2" />
        </div>
        {fileName && !error && groups && <p className="text-xs text-gray-500">{fileName}</p>}
      </Surface>

      {error && <Alert tone="danger">{error}</Alert>}
      {groups?.map((g) => (
        <GroupCard key={g.name || 'work-orders'} group={g} associations={associations} importWorkOrders={importWorkOrders} />
      ))}
    </div>
  );
}
