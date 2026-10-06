import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { csvCell } from '@/lib/csv/cell';

import {
  isSupportedReportOutputFormat,
  reportFormatLabel,
  supportedReportOutputFormats,
  SUPPORTED_REPORT_OUTPUT_FORMATS,
  type SupportedReportOutputFormat,
} from '@/lib/reports/formats';

export {
  isSupportedReportOutputFormat,
  reportFormatLabel,
  supportedReportOutputFormats,
  SUPPORTED_REPORT_OUTPUT_FORMATS,
  type SupportedReportOutputFormat,
};

export type ReportOutput = {
  body: Uint8Array;
  contentType: string;
  extension: SupportedReportOutputFormat;
};

export type ReportOutputContext = {
  title?: string;
  /** The management company the report belongs to (white label: files never name the platform). */
  companyName?: string | null;
  scope?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return 'No data\n';
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = csvCell;
  return [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n') + '\n';
}

function humanizeHeader(value: string): string {
  const text = value.replace(/_/g, ' ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

/** The report's title, or the company's name, never the platform's. */
export function reportTitle(context: ReportOutputContext): string {
  const company = context.companyName?.trim();
  return context.title?.trim() || (company ? `${company} report` : 'Report');
}

function rowsToPdf(rows: Record<string, unknown>[], context: ReportOutputContext): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const headers = rows.length === 0 ? ['Result'] : [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const body = rows.length === 0
    ? [['No data']]
    : rows.map((row) => headers.map((header) => {
      const value = row[header];
      return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    }));

  const title = reportTitle(context);
  const scope = context.scope?.trim() || 'Portfolio';
  doc.setProperties({ title, author: context.companyName?.trim() || '', creator: context.companyName?.trim() || '' });
  const period = context.dateFrom && context.dateTo
    ? `${context.dateFrom} through ${context.dateTo}`
    : context.dateTo
      ? `As of ${context.dateTo}`
      : 'Current data';
  autoTable(doc, {
    head: [headers.map(humanizeHeader)],
    body,
    startY: 75,
    margin: { top: 75, left: 40, right: 40, bottom: 36 },
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 41, 55] },
    didDrawPage: ({ pageNumber }) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(title, 40, 34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Scope: ${scope}`, 40, 49);
      doc.text(`Reporting period: ${period}`, 40, 61);
      doc.text(`Page ${pageNumber}`, 572, 34, { align: 'right' });
    },
  });
  return new Uint8Array(doc.output('arraybuffer'));
}

const XLSX_MAX_CELL = 32767;

function xlsxCell(value: unknown): string | number | boolean | Date | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (value instanceof Date) return value;
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Written as a string cell, which Excel never evaluates, so a value that
  // starts with "=" stays inert text without changing what the user sees.
  return text.length > XLSX_MAX_CELL ? text.slice(0, XLSX_MAX_CELL) : text;
}

async function rowsToXlsx(rows: Record<string, unknown>[], context: ReportOutputContext): Promise<Uint8Array> {
  // Loaded on demand so the report worker only pays for it when Excel is picked.
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = context.companyName?.trim() || '';
  workbook.created = new Date();
  const title = reportTitle(context);
  // Sheet names: max 31 chars, no : \ / ? * [ ]
  const sheet = workbook.addWorksheet(title.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Report');

  const period = context.dateFrom && context.dateTo
    ? `${context.dateFrom} through ${context.dateTo}`
    : context.dateTo ? `As of ${context.dateTo}` : 'Current data';
  sheet.addRow([title]).font = { bold: true, size: 14 };
  sheet.addRow([`Scope: ${context.scope?.trim() || 'Portfolio'}`]);
  sheet.addRow([`Reporting period: ${period}`]);
  sheet.addRow([]);

  const headers = rows.length === 0 ? ['Result'] : [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const headerRow = sheet.addRow(headers.map(humanizeHeader));
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.border = { bottom: { style: 'thin' } };
  });
  if (rows.length === 0) sheet.addRow(['No data']);
  for (const row of rows) sheet.addRow(headers.map((header) => xlsxCell(row[header])));

  // Freeze the header, size columns to their content (capped), and number
  // format money-looking columns.
  sheet.views = [{ state: 'frozen', ySplit: headerRow.number }];
  headers.forEach((header, i) => {
    const column = sheet.getColumn(i + 1);
    const longest = Math.max(
      humanizeHeader(header).length,
      ...rows.slice(0, 500).map((row) => String(row[header] ?? '').length),
    );
    column.width = Math.min(Math.max(longest + 2, 10), 60);
    if (/(amount|balance|total|debit|credit|paid|due|budget|actual|variance|fee|cost|price|payment)/i.test(header)
      && rows.some((row) => typeof row[header] === 'number')) {
      column.numFmt = '#,##0.00;[Red]-#,##0.00';
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export async function serializeReportOutput(
  format: SupportedReportOutputFormat,
  rows: Record<string, unknown>[],
  context: ReportOutputContext = {},
): Promise<ReportOutput> {
  switch (format) {
    case 'xlsx':
      return {
        body: await rowsToXlsx(rows, context),
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
      };
    case 'json':
      return {
        body: Buffer.from(JSON.stringify(rows, null, 2), 'utf8'),
        contentType: 'application/json',
        extension: 'json',
      };
    case 'pdf':
      return {
        body: rowsToPdf(rows, context),
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
