import Papa from 'papaparse';

// Header aliases → canonical keys the import RPCs expect.
const ALIASES: Record<string, string> = {
  entry: 'entry', 'entry #': 'entry', 'entry number': 'entry', reference: 'entry', ref: 'entry',
  date: 'date', 'entry date': 'date',
  association: 'association', property: 'association',
  gl: 'gl', 'gl account': 'gl', account: 'gl', 'gl account number': 'gl',
  debit: 'debit', credit: 'credit', memo: 'memo', description: 'memo',
  vendor: 'vendor', payee: 'vendor', 'bill number': 'bill_number', 'bill #': 'bill_number', 'invoice number': 'bill_number', invoice: 'bill_number',
  'bill date': 'bill_date', 'invoice date': 'bill_date', 'due date': 'due_date', amount: 'amount',
};

export const canonicalHeader = (h: string) => {
  const key = h.trim().toLowerCase().replace(/_/g, ' ');
  return ALIASES[key] ?? h.trim().toLowerCase();
};

/** Parse an import CSV; row numbers match the spreadsheet (header = row 1). */
export function parseImportCsv(text: string): { rows?: Record<string, string>[]; error?: string } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: canonicalHeader,
  });
  if (parsed.errors.length) {
    return { error: `Could not read the CSV (line ${(parsed.errors[0].row ?? 0) + 2}): ${parsed.errors[0].message}` };
  }
  if (!parsed.data.length) return { error: 'The file has no rows.' };
  return { rows: parsed.data.map((r, i) => ({ ...r, row: String(i + 2) })) };
}
