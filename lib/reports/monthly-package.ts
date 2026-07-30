import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type MonthlyPackageSection = {
  title: string;
  rows: Record<string, unknown>[];
};

function humanize(value: string): string {
  const text = value.replace(/_/g, ' ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function cell(value: unknown): string {
  if (value == null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function generateMonthlyFinancialPackagePdf(options: {
  associationName: string;
  dateFrom: string;
  dateTo: string;
  sections: MonthlyPackageSection[];
}): Uint8Array {
  const { associationName, dateFrom, dateTo, sections } = options;
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
  doc.text('Generated from posted Portier369 accounting data', 396, 300, { align: 'center' });
  doc.setDrawColor(40, 55, 75);
  doc.line(150, 320, 642, 320);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CONTENTS', 150, 350);
  doc.setFont('helvetica', 'normal');
  sections.forEach((section, index) => doc.text(`${index + 1}. ${section.title}`, 170, 372 + index * 18));

  sections.forEach((section) => {
    doc.addPage('letter', 'landscape');
    const keys = section.rows.length ? [...new Set(section.rows.flatMap((row) => Object.keys(row)))] : ['result'];
    const body = section.rows.length
      ? section.rows.map((row) => keys.map((key) => cell(row[key])))
      : [['No data for this period']];
    autoTable(doc, {
      head: [keys.map(humanize)],
      body,
      startY: 80,
      margin: { top: 80, right: 36, bottom: 34, left: 36 },
      styles: { fontSize: 6.5, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [31, 41, 55], fontSize: 6.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      horizontalPageBreak: true,
      didDrawPage: () => {
        doc.setTextColor(0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text(section.title, 36, 32);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(associationName, 36, 47);
        doc.text(`${dateFrom} through ${dateTo}`, 36, 59);
        doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, 756, 32, { align: 'right' });
      },
    });
  });
  return new Uint8Array(doc.output('arraybuffer'));
}
