'use client';

// Reusable CSV uploader. Parses a .csv with papaparse, validates each row with a
// caller-supplied validator, shows a preview table with per-row status, then
// posts the valid rows (as JSON) to a caller-supplied server action and renders
// the resulting summary.
//
// Generic on the row shape so both the owners/units importer and the opening
// balances importer reuse it without modification.
import * as React from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';

export type RowValidation = { ok: boolean; reason?: string };

export type ImportSummary = {
  imported: number;
  skipped: number;
  errors?: string[];
};

export type CsvUploaderProps = {
  /** Column headers the CSV is expected to contain (shown to the user). */
  expectedColumns: string[];
  /** Validate one parsed row. Return ok:false + reason to flag it. */
  validateRow: (row: Record<string, string>, index: number) => RowValidation;
  /** Server action that imports the valid rows. Receives rows as plain objects. */
  action: (rows: Record<string, string>[]) => Promise<ImportSummary>;
  /** Optional template-download href (GET route returning a CSV). */
  templateHref?: string;
  /** Label for the import button noun, e.g. "rows", "owners". Defaults to "rows". */
  noun?: string;
};

type ParsedRow = {
  index: number;
  data: Record<string, string>;
  validation: RowValidation;
};

export function CsvUploader({
  expectedColumns,
  validateRow,
  action,
  templateHref,
  noun = 'rows',
}: CsvUploaderProps) {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<ParsedRow[]>([]);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const validRows = rows.filter((r) => r.validation.ok);
  const invalidCount = rows.length - validRows.length;

  function reset() {
    setRows([]);
    setParseError(null);
    setSummary(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setSummary(null);
    setParseError(null);
    setRows([]);
    if (!file) {
      setFileName(null);
      return;
    }
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        if (res.errors?.length) {
          setParseError(res.errors[0].message || 'Could not parse the CSV file.');
        }
        const parsed = (res.data || []).map((raw, i) => {
          // Trim every value so validators see clean strings.
          const data: Record<string, string> = {};
          for (const k of Object.keys(raw)) {
            const v = raw[k];
            data[k] = typeof v === 'string' ? v.trim() : v == null ? '' : String(v);
          }
          return { index: i, data, validation: validateRow(data, i) };
        });
        setRows(parsed);
      },
      error: (err) => setParseError(err.message),
    });
  }

  function onImport() {
    if (!validRows.length) return;
    startTransition(async () => {
      try {
        const result = await action(validRows.map((r) => r.data));
        setSummary(result);
      } catch (err: any) {
        setParseError(err?.message ?? 'Import failed.');
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Expected columns + template */}
      <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">Upload a CSV</div>
            <p className="mt-1 text-xs text-gray-500">
              Expected columns:{' '}
              {expectedColumns.map((c, i) => (
                <span key={c}>
                  <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-700">{c}</code>
                  {i < expectedColumns.length - 1 ? ' ' : ''}
                </span>
              ))}
            </p>
          </div>
          {templateHref && (
            <a href={templateHref} download>
              <Button variant="secondary" size="sm" type="button">Download template</Button>
            </a>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="block text-sm text-gray-700 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-800 hover:file:bg-gray-50"
          />
          {fileName && (
            <Button variant="ghost" size="sm" type="button" onClick={reset}>Clear</Button>
          )}
        </div>

        {parseError && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {parseError}
          </div>
        )}
      </div>

      {/* Preview */}
      {rows.length > 0 && !summary && (
        <div className="rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
            <div className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">{rows.length}</span> rows parsed
              {' · '}
              <span className="font-medium text-emerald-700">{validRows.length} valid</span>
              {invalidCount > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-red-700">{invalidCount} with errors</span>
                </>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              onClick={onImport}
              disabled={isPending || validRows.length === 0}
            >
              {isPending ? 'Importing…' : `Import ${validRows.length} valid ${noun}`}
            </Button>
          </div>

          <div className="max-h-[28rem] overflow-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Status</th>
                  {expectedColumns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-4 py-2 font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.index} className={r.validation.ok ? '' : 'bg-red-50/40'}>
                    <td className="whitespace-nowrap px-4 py-2">
                      {r.validation.ok ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Valid</span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700" title={r.validation.reason}>
                          {r.validation.reason ?? 'Error'}
                        </span>
                      )}
                    </td>
                    {expectedColumns.map((c) => (
                      <td key={c} className="whitespace-nowrap px-4 py-2 text-gray-700">{r.data[c] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result summary */}
      {summary && (
        <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="text-sm font-semibold text-gray-900">Import complete</div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span className="text-emerald-700">{summary.imported} imported</span>
            <span className="text-gray-500">{summary.skipped} skipped</span>
          </div>
          {summary.errors && summary.errors.length > 0 && (
            <div className="mt-3 max-h-48 overflow-auto rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <div className="mb-1 font-medium">Issues:</div>
              <ul className="list-inside list-disc space-y-0.5">
                {summary.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4">
            <Button variant="secondary" size="sm" type="button" onClick={reset}>Import another file</Button>
          </div>
        </div>
      )}
    </div>
  );
}
