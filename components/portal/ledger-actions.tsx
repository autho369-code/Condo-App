'use client';

// Export / print actions for the owner Account Ledger. White-glove: the PDF
// and CSV carry the management company + association branding, never Portier369.
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Download, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { todayInZone } from '@/lib/time/zoned';
import { groupByAssociation } from '@/lib/portal/ledger-rows';

export type LedgerChargeRow = {
  /** The unit's association: the export has one header per association. */
  association: string;
  /** Groups the export (association names are not unique). */
  associationId?: string;
  unit: string;
  date: string;
  description: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
};

export type LedgerPaymentRow = {
  association: string;
  associationId?: string;
  unit: string;
  date: string;
  method: string;
  reference: string;
  amount: number;
  /** 'Returned' (with reason) when the payment was reversed, else ''. */
  status: string;
};

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

function csvEscape(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function LedgerActions({
  ownerName,
  companyName,
  associationName,
  charges,
  payments,
  totalBalance,
}: {
  ownerName: string;
  companyName: string;
  associationName: string;
  charges: LedgerChargeRow[];
  payments: LedgerPaymentRow[];
  totalBalance: number;
}) {
  const stamp = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const fileBase = `account-ledger-${todayInZone()}`;
  // One section per association, each under its own header.
  const groups = groupByAssociation(charges, payments, associationName);

  function downloadCsv() {
    const lines: string[] = [];
    lines.push(csvEscape(`Account Ledger — ${ownerName}`));
    lines.push(csvEscape(companyName));
    lines.push(`Generated ${stamp}`);
    for (const g of groups) {
      lines.push('');
      lines.push(csvEscape(`${companyName} — ${g.association}`));
      lines.push('CHARGES');
      lines.push(['Date', 'Unit', 'Description', 'Amount', 'Paid', 'Balance', 'Status'].join(','));
      for (const c of g.charges) {
        lines.push([c.date, csvEscape(c.unit), csvEscape(c.description), c.amount.toFixed(2), c.paid.toFixed(2), c.balance.toFixed(2), c.status].join(','));
      }
      lines.push('');
      lines.push('PAYMENTS');
      lines.push(['Date', 'Unit', 'Method', 'Reference', 'Amount', 'Status'].join(','));
      for (const p of g.payments) {
        lines.push([p.date, csvEscape(p.unit), csvEscape(p.method), csvEscape(p.reference), p.amount.toFixed(2), csvEscape(p.status)].join(','));
      }
    }
    lines.push('');
    lines.push(`Current balance,${totalBalance.toFixed(2)}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileBase}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadPdf() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Account Ledger', 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90);
    doc.text(ownerName, 14, 25);
    doc.text(`${companyName} · Generated ${stamp}`, 14, 30);
    doc.setTextColor(0);

    let y = 32;
    for (const g of groups) {
      // Each association starts with its own header (on a new page when the
      // previous section ended near the bottom).
      if (y > 240) { doc.addPage(); y = 10; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(g.association, 14, y + 8);
      doc.setFontSize(10);
      doc.text('Charges', 14, y + 14);

      (doc as any).autoTable({
        startY: y + 17,
        head: [['Date', 'Unit', 'Description', 'Amount', 'Paid', 'Balance', 'Status']],
        body: g.charges.map((c) => [c.date, c.unit, c.description, usd(c.amount), usd(c.paid), usd(c.balance), c.status]),
        styles: { fontSize: 8.5 },
        headStyles: { fillColor: [17, 24, 39] },
        columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      });

      const afterCharges = (doc as any).lastAutoTable?.finalY ?? y + 20;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Payments', 14, afterCharges + 8);

      (doc as any).autoTable({
        startY: afterCharges + 11,
        head: [['Date', 'Unit', 'Method', 'Reference', 'Amount', 'Status']],
        body: g.payments.map((p) => [p.date, p.unit, p.method, p.reference, usd(p.amount), p.status]),
        styles: { fontSize: 8.5 },
        headStyles: { fillColor: [17, 24, 39] },
        columnStyles: { 4: { halign: 'right' } },
      });
      y = (doc as any).lastAutoTable?.finalY ?? afterCharges + 20;
    }

    if (y > 270) { doc.addPage(); y = 10; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Current balance: ${usd(totalBalance)}`, 14, y + 10);

    doc.save(`${fileBase}.pdf`);
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button type="button" variant="secondary" size="sm" onClick={() => window.print()}>
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
