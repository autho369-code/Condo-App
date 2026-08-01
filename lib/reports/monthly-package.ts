import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type MonthlyPackageSection = {
  title: string;
  rows: Record<string, unknown>[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function pick(row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(row, key)).map((key) => [key, row[key]]));
}

export function prepareMonthlyPackageRows(
  slug: string,
  rows: Record<string, unknown>[],
  dateTo: string,
): Record<string, unknown>[] {
  if (slug === 'budget_vs_actual') {
    const monthIndex = Math.max(0, Math.min(11, Number(dateTo.slice(5, 7)) - 1));
    const month = MONTHS[monthIndex];
    const budgetKeys = MONTHS.slice(0, monthIndex + 1).map((label) => `${label} budget`);
    const actualKeys = MONTHS.slice(0, monthIndex + 1).map((label) => `${label} actual`);
    return rows.map((row) => {
      const periodBudget = Number(row[`${month} budget`] ?? 0);
      const periodActual = Number(row[`${month} actual`] ?? 0);
      const ytdBudget = budgetKeys.reduce((sum, key) => sum + Number(row[key] ?? 0), 0);
      const ytdActual = actualKeys.reduce((sum, key) => sum + Number(row[key] ?? 0), 0);
      return {
        Category: row.Category,
        'Account #': row['Account #'],
        Account: row.Account,
        [`${month} budget`]: periodBudget,
        [`${month} actual`]: periodActual,
        [`${month} variance`]: periodActual - periodBudget,
        'YTD budget': ytdBudget,
        'YTD actual': ytdActual,
        'YTD variance': ytdActual - ytdBudget,
      };
    });
  }

  const columns: Record<string, readonly string[]> = {
    trial_balance: ['Account #', 'Account', 'Type', 'Debit', 'Credit', 'Net balance', 'As of'],
    balance_sheet: ['Section', 'Account #', 'Account', 'Type', 'Amount', 'Period'],
    income_statement: ['Section', 'Account #', 'Account', 'Type', 'Amount', 'Period'],
    ar_aging: ['Unit', 'Description', 'Due date', 'Aging bucket', 'Charged', 'Paid', 'Balance due'],
    delinquency_summary: ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days', 'Total delinquent', 'Open charges'],
    ap_aging: ['Vendor', 'Bill #', 'Bill date', 'Due date', 'Memo', 'Status', 'Aging bucket', 'Balance due', 'As of'],
    bank_reconciliation: ['Account', 'Bank', 'Statement date', 'Statement balance', 'Book balance', 'Difference', 'Status', 'Completed at'],
  };
  return columns[slug] ? rows.map((row) => pick(row, columns[slug])) : rows;
}

function humanize(value: string): string {
  const text = value.replace(/_/g, ' ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function categorical(value: string): string {
  const labels: Record<string, string> = {
    current: 'Current',
    '1_30': '1-30 days',
    '31_60': '31-60 days',
    '61_90': '61-90 days',
    '90_plus': '90+ days',
  };
  return labels[value] ?? humanize(value);
}

const MONEY_COLUMN = /(?:debit|credit|balance|amount|paid|variance|current|\d+-\d+ days|90\+ days|delinquent|budget|actual|charged|difference)/i;

function cell(key: string, value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'number' && MONEY_COLUMN.test(key)) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }
  if (typeof value === 'string' && /^(?:section|category|type|status|aging bucket)$/i.test(key)) {
    return categorical(value);
  }
  if (typeof value === 'string' && /^completed at$/i.test(key)) return value.slice(0, 10);
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function generateMonthlyFinancialPackagePdf(options: {
  associationName: string;
  companyName?: string | null;
  dateFrom: string;
  dateTo: string;
  sections: MonthlyPackageSection[];
}): Uint8Array {
  const { associationName, companyName, dateFrom, dateTo, sections } = options;
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('Monthly Financial Statement Package', 396, 185, { align: 'center' });
  doc.setFontSize(17);
  doc.text(associationName, 396, 220, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${dateFrom} through ${dateTo}`, 396, 246, { align: 'center' });
  doc.setFontSize(9);
  doc.text('Balance sheet, income statement, budget variance, receivables, delinquencies, payables, and bank reconciliation', 396, 282, { align: 'center' });
  doc.text(`Prepared by ${companyName?.trim() || 'Management Company'}`, 396, 300, { align: 'center' });
  doc.setDrawColor(40, 55, 75);
  doc.line(150, 320, 642, 320);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CONTENTS', 150, 350);
  doc.setFont('helvetica', 'normal');
  sections.forEach((section, index) => doc.text(`${index + 1}. ${section.title}`, 170, 372 + index * 18));

  sections.forEach((section) => {
    const sectionStartPage = doc.getNumberOfPages() + 1;
    const keys = section.rows.length ? [...new Set(section.rows.flatMap((row) => Object.keys(row)))] : ['result'];
    const body = section.rows.length
      ? section.rows.map((row) => keys.map((key) => cell(key, row[key])))
      : [['No data for this period']];
    const columnStyles = Object.fromEntries(keys.flatMap((key, index) =>
      MONEY_COLUMN.test(key) ? [[index, { halign: 'right' as const }]] : [],
    ));
    autoTable(doc, {
      head: [keys.map(humanize)],
      body,
      pageBreak: 'always',
      startY: 80,
      margin: { top: 80, right: 36, bottom: 34, left: 36 },
      styles: { fontSize: 6.5, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [31, 41, 55], fontSize: 6.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles,
      didDrawPage: ({ pageNumber }) => {
        const absolutePageNumber = sectionStartPage + pageNumber - 1;
        const pageWidth = doc.internal.pageSize.getWidth();
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(section.title, 36, 32);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(associationName, 36, 47);
        doc.text(`${dateFrom} through ${dateTo}`, 36, 59);
        doc.text(`Page ${absolutePageNumber}`, pageWidth - 36, 32, { align: 'right' });
      },
    });
  });
  return new Uint8Array(doc.output('arraybuffer'));
}
