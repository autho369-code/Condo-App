'use client';

// Reads AppFolio's Vendor Directory export in the browser
// (lib/imports/appfolio-vendors), previews the vendors it found and imports
// them into this company's vendor list. The server action re-validates every
// field and skips vendors that already exist; this only previews.
import * as React from 'react';
import { Alert, Badge, SectionTitle, Surface } from '@/components/ui/shell';
import { Table, THead, TR, TH, TD } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { parseAppfolioVendorDirectory, type AppfolioVendor } from '@/lib/imports/appfolio-vendors';
import type { importAppfolioVendors, VendorImportSummary } from './vendor-actions';

const PREVIEW_ROWS = 100;

const soonestExpiration = (v: AppfolioVendor) =>
  [
    v.workers_comp_expiration, v.general_liability_expiration, v.epa_certification_expiration,
    v.auto_insurance_expiration, v.state_license_expiration, v.contract_expiration,
  ].filter((d): d is string => !!d).sort()[0] ?? null;

export function VendorImportSection({ importVendors }: { importVendors: typeof importAppfolioVendors }) {
  const [vendors, setVendors] = React.useState<AppfolioVendor[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<VendorImportSummary | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setVendors(null);
    setError(null);
    setResult(null);
    if (!file) return;
    setFileName(file.name);
    try {
      const parsed = parseAppfolioVendorDirectory(await file.text());
      if (parsed.error || !parsed.vendors) { setError(parsed.error ?? 'Could not read the file.'); return; }
      setVendors(parsed.vendors);
    } catch (err) {
      setError(err instanceof Error ? `Could not read the file: ${err.message}` : 'Could not read the file.');
    }
  }

  async function run() {
    if (!vendors) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await importVendors(vendors.map((v) => ({ ...v }))));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The import failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const withEmail = vendors?.filter((v) => v.emails.length).length ?? 0;
  const with1099 = vendors?.filter((v) => v.send_1099).length ?? 0;

  return (
    <div className="space-y-5">
      <Surface className="space-y-3">
        <SectionTitle
          title="Vendors — AppFolio Vendor Directory"
          description="In AppFolio open Reports → Vendor Directory, then Actions → Export as CSV. Vendors that already exist here with the same name are skipped, so importing the same file twice is safe. A renamed vendor is imported as a new one."
          className="mb-0"
        />
        <div>
          <Label htmlFor="appfolio-vendor-file">Vendor Directory CSV</Label>
          <Input id="appfolio-vendor-file" type="file" accept=".csv,text/csv" onChange={onFile} className="h-auto py-2" />
        </div>
        {fileName && vendors && <p className="text-xs text-gray-500">{fileName}</p>}
      </Surface>

      {error && <Alert tone="danger">{error}</Alert>}

      {vendors && (
        <Surface className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info" className="normal-case">{vendors.length} vendor{vendors.length === 1 ? '' : 's'}</Badge>
            <Badge tone="inactive" className="normal-case">{withEmail} with email</Badge>
            <Badge tone="inactive" className="normal-case">{with1099} send 1099</Badge>
          </div>

          <Table>
            <THead>
              <TR>
                <TH>Vendor</TH>
                <TH>Phone</TH>
                <TH>Email</TH>
                <TH>Default GL</TH>
                <TH>Payment</TH>
                <TH>1099</TH>
                <TH>Next expiration</TH>
              </TR>
            </THead>
            <tbody>
              {vendors.slice(0, PREVIEW_ROWS).map((v) => (
                <TR key={v.row}>
                  <TD>
                    <div className="font-medium text-gray-900">{v.name}</div>
                    {v.contact_name && <div className="text-xs text-gray-500">{v.contact_name}</div>}
                  </TD>
                  <TD className="whitespace-nowrap">{v.phones[0]?.number ?? '—'}{v.phones.length > 1 ? ` +${v.phones.length - 1}` : ''}</TD>
                  <TD>{v.emails[0] ?? '—'}{v.emails.length > 1 ? ` +${v.emails.length - 1}` : ''}</TD>
                  <TD>{v.gl_account_number ? `${v.gl_account_number}${v.gl_account_label ? ` · ${v.gl_account_label}` : ''}` : '—'}</TD>
                  <TD className="capitalize">{v.payment_type ?? v.payment_type_raw ?? '—'}</TD>
                  <TD>{v.send_1099 ? 'Yes' : 'No'}</TD>
                  <TD className="whitespace-nowrap tabular-nums">{soonestExpiration(v) ?? '—'}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          {vendors.length > PREVIEW_ROWS && (
            <p className="text-xs text-gray-500">Showing the first {PREVIEW_ROWS} of {vendors.length} vendors. All of them are imported.</p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Button type="button" disabled={busy || result !== null} onClick={run}>
              {busy ? 'Importing…' : result ? 'Imported' : `Import ${vendors.length} vendor${vendors.length === 1 ? '' : 's'}`}
            </Button>
          </div>

          {result && (
            <Alert tone={result.imported > 0 ? 'success' : 'warning'} title={`${result.imported} created, ${result.skipped} skipped.`}>
              {result.errors?.length ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {result.errors.slice(0, 50).map((e, i) => <li key={i}>{e}</li>)}
                  {result.errors.length > 50 && <li>…and {result.errors.length - 50} more.</li>}
                </ul>
              ) : null}
            </Alert>
          )}
        </Surface>
      )}
    </div>
  );
}
