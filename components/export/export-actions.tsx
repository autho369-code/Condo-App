'use client';

// Platform-wide export system: Print / CSV / branded PDF for any tabular
// surface. White-glove: exports carry the management company + context —
// never Portier369. Used across manager lists, board financials, and owner
// pages; pass pre-rendered cell strings from the server component so the
// export matches exactly what is on screen.
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Download, FileText, Printer } from 'lucide-react';

export type ExportTable = {
  /** Optional section heading shown above the table in PDF/CSV */
  title?: string;
  columns: { header: string; align?: 'right' }[];
  rows: (string | number)[][];
};

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExportActions({
  documentTitle,
  subtitle,
  companyName,
  filename,
  tables,
  footerLine,
}: {
  /** e.g. "Delinquencies" / "Receivables" */
  documentTitle: string;
  /** context line, e.g. association or owner name */
  subtitle?: string;
  /** management company name for the white-label header */
  companyName: string;
  /** file base name without extension */
  filename: string;
  tables: ExportTable[];
  /** e.g. "Total outstanding: $2,250.00" */
  footerLine?: string;
}) {
  const stamp = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  function downloadCsv() {
    const lines: string[] = [];
    lines.push(documentTitle);
    if (subtitle) lines.push(subtitle);
    lines.push(`${companyName} — generated ${stamp}`);
    for (const t of tables) {
      lines.push('');
      if (t.title) lines.push(t.title.toUpperCase());
      lines.push(t.columns.map((c) => csvEscape(c.header)).join(','));
      for (const r of t.rows) lines.push(r.map(csvEscape).join(','));
    }
    if (footerLine) {
      lines.push('');
      lines.push(csvEscape(footerLine));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadPdf() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(documentTitle, 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90);
    if (subtitle) doc.text(subtitle, 14, 25);
    doc.text(`${companyName} · Generated ${stamp}`, 14, subtitle ? 30 : 25);
    doc.setTextColor(0);

    let y = subtitle ? 36 : 31;
    for (const t of tables) {
      if (t.title) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(t.title, 14, y + 4);
        doc.setFont('helvetica', 'normal');
        y += 7;
      }
      const columnStyles: Record<number, { halign: 'right' }> = {};
      t.columns.forEach((c, i) => { if (c.align === 'right') columnStyles[i] = { halign: 'right' }; });
      (doc as any).autoTable({
        startY: y,
        head: [t.columns.map((c) => c.header)],
        body: t.rows.map((r) => r.map(String)),
        styles: { fontSize: 8.5 },
        headStyles: { fillColor: [17, 24, 39] },
        columnStyles,
      });
      y = ((doc as any).lastAutoTable?.finalY ?? y) + 8;
    }
    if (footerLine) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(footerLine, 14, y + 2);
    }
    doc.save(`${filename}.pdf`);
  }

  const btn =
    'inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-800 shadow-sm transition hover:bg-gray-50';

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className={btn}>
        <Printer className="h-3.5 w-3.5 text-gray-400" /> Print
      </button>
      <button type="button" onClick={downloadCsv} className={btn}>
        <Download className="h-3.5 w-3.5 text-gray-400" /> CSV
      </button>
      <button type="button" onClick={downloadPdf} className={btn}>
        <FileText className="h-3.5 w-3.5 text-gray-400" /> PDF
      </button>
    </div>
  );
}
