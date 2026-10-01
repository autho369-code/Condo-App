'use client';
import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/shell';
import type { ImportResult } from '@/lib/rpcs/imports';

/** CSV file picker + all-or-nothing import result (row-numbered errors). */
export function CsvUploadForm({
  action,
  templateCsv,
  templateName,
  showName = false,
  submitLabel,
  extraFields,
}: {
  action: (prev: ImportResult | null, formData: FormData) => Promise<ImportResult>;
  templateCsv: string;
  templateName: string;
  showName?: boolean;
  submitLabel: string;
  /** Additional inputs rendered before the file picker. */
  extraFields?: React.ReactNode;
}) {
  const [result, formAction, pending] = React.useActionState(action, null);
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`;
  return (
    <form action={formAction} className="space-y-4">
      {result && (
        <Alert tone={result.ok ? 'success' : 'danger'} title={result.message}>
          {result.href && <Link href={result.href} className="font-medium underline">{result.ok ? 'View them' : 'Open it'}</Link>}
          {!result.ok && result.errors && result.errors.length > 0 && (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              {(result.errorCount ?? 0) > result.errors.length && <li>…and {(result.errorCount ?? 0) - result.errors.length} more</li>}
            </ul>
          )}
        </Alert>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {extraFields}
        {showName && (
          <Field label="Batch name" htmlFor="name" hint="Optional — shown in Journal Entry Batches.">
            <Input id="name" name="name" maxLength={120} placeholder="September accruals" />
          </Field>
        )}
        <Field label="CSV file" htmlFor="file" required hint="Up to 2 MB. Save from Excel or Google Sheets as CSV.">
          <input id="file" name="file" type="file" accept=".csv,text/csv" required
            className="block w-full text-sm text-gray-700 file:mr-3 file:h-10 file:rounded-lg file:border file:border-gray-300 file:bg-white file:px-3 file:text-sm file:font-medium file:text-gray-800 hover:file:bg-gray-50" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href={templateHref} download={templateName} className="text-sm font-medium text-gray-700 underline underline-offset-4 hover:text-gray-950">
          Download template
        </a>
        <Button type="submit" disabled={pending}>{pending ? 'Checking…' : submitLabel}</Button>
      </div>
    </form>
  );
}
