'use client';

// Platform-wide export system: Print / CSV / branded PDF for any tabular
// surface. White-glove: exports carry the management company + context -
// never Portier369. Used across manager lists, board financials, and owner
// pages; pass pre-rendered cell strings from the server component so the
// export matches exactly what is on screen.
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Download, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PRINT_ON_LOAD_SCRIPT } from '@/lib/print-script';
import { escapeHtmlText } from '@/lib/security/rich-text';

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
  printFromTables = false,
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
  /**
   * Print the export tables in their own window instead of the page. Set it
   * when the page shows only part of the rows, so Print matches CSV and PDF.
   */
  printFromTables?: boolean;
}) {
  const stamp = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  function downloadCsv() {
    const lines: string[] = [];
    lines.push(documentTitle);
    if (subtitle) lines.push(subtitle);
    lines.push(`${companyName} - generated ${stamp}`);
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
    doc.text(`${companyName} - Generated ${stamp}`, 14, subtitle ? 30 : 25);
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

  function printTables() {
    const sections = tables.map((t) => `
      ${t.title ? `<h2>${escapeHtmlText(t.title)}</h2>` : ''}
      <table>
        <thead><tr>${t.columns.map((c) => `<th${c.align === 'right' ? ' class="r"' : ''}>${escapeHtmlText(c.header)}</th>`).join('')}</tr></thead>
        <tbody>${t.rows.map((r) => `<tr>${r.map((v, i) => `<td${t.columns[i]?.align === 'right' ? ' class="r"' : ''}>${escapeHtmlText(String(v))}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`).join('');
    const doc = `<!DOCTYPE html>
      <html><head>
        <meta charset="utf-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
        <title>${escapeHtmlText(documentTitle)}</title>
        <style>
          body { font-family: system-ui, -apple-system, 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #111827; margin: 1.5rem; }
          h1 { font-size: 16pt; margin: 0 0 0.25rem; }
          .meta { color: #6b7280; margin: 0 0 1rem; }
          h2 { font-size: 11pt; margin: 1.25rem 0 0.5rem; }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          th { font-weight: 600; border-bottom-color: #111827; }
          .r { text-align: right; font-variant-numeric: tabular-nums; }
          .footer { margin-top: 1rem; font-weight: 600; }
        </style>
      </head><body>
        <h1>${escapeHtmlText(documentTitle)}</h1>
        <p class="meta">${subtitle ? `${escapeHtmlText(subtitle)} · ` : ''}${escapeHtmlText(companyName)} · Generated ${escapeHtmlText(stamp)}</p>
        ${sections}
        ${footerLine ? `<p class="footer">${escapeHtmlText(footerLine)}</p>` : ''}
        <script>${PRINT_ON_LOAD_SCRIPT}</script>
      </body></html>`;
    // Blob document + noopener, as the batch letters print (every value is
    // escaped above).
    const url = URL.createObjectURL(new Blob([doc], { type: 'text/html' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button type="button" variant="secondary" size="sm" onClick={() => (printFromTables ? printTables() : window.print())}>
        <Printer className="h-3.5 w-3.5 text-gray-400" /> Print
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={downloadCsv}>
        <Download className="h-3.5 w-3.5 text-gray-400" /> CSV
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={downloadPdf}>
        <FileText className="h-3.5 w-3.5 text-gray-400" /> PDF
      </Button>
    </div>
  );
}
