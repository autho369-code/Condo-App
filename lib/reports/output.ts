import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const SUPPORTED_REPORT_OUTPUT_FORMATS = ['csv', 'json', 'pdf'] as const;
export type SupportedReportOutputFormat = (typeof SUPPORTED_REPORT_OUTPUT_FORMATS)[number];

export type ReportOutput = {
  body: Uint8Array;
  contentType: string;
  extension: SupportedReportOutputFormat;
};

export function isSupportedReportOutputFormat(value: unknown): value is SupportedReportOutputFormat {
  return typeof value === 'string' && (SUPPORTED_REPORT_OUTPUT_FORMATS as readonly string[]).includes(value);
}

/** Keep catalog metadata honest: never offer a format this service cannot create. */
export function supportedReportOutputFormats(values: unknown): SupportedReportOutputFormat[] {
  const requested = Array.isArray(values) ? values : [];
  const supported = requested.filter(isSupportedReportOutputFormat);
  return supported.length > 0 ? [...new Set(supported)] : ['csv'];
}

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return 'No data\n';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: unknown) => {
    if (value == null) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n') + '\n';
}

function rowsToPdf(rows: Record<string, unknown>[]): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const headers = rows.length === 0 ? ['Result'] : [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const body = rows.length === 0
    ? [['No data']]
    : rows.map((row) => headers.map((header) => {
      const value = row[header];
      return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    }));

  doc.setFontSize(12);
  doc.text('Portier369 report', 40, 36);
  autoTable(doc, {
    head: [headers],
    body,
    startY: 52,
    margin: { left: 40, right: 40 },
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 41, 55] },
  });
  return new Uint8Array(doc.output('arraybuffer'));
}

export function serializeReportOutput(
  format: SupportedReportOutputFormat,
  rows: Record<string, unknown>[],
): ReportOutput {
  switch (format) {
    case 'json':
      return {
        body: Buffer.from(JSON.stringify(rows, null, 2), 'utf8'),
        contentType: 'application/json',
        extension: 'json',
      };
    case 'pdf':
      return {
        body: rowsToPdf(rows),
        contentType: 'application/pdf',
        extension: 'pdf',
      };
    case 'csv':
      return {
        body: Buffer.from(rowsToCsv(rows), 'utf8'),
        contentType: 'text/csv; charset=utf-8',
        extension: 'csv',
      };
  }
}
