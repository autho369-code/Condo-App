'use client';

// Export / print actions for the owner Account Ledger. White-glove: the PDF
// and CSV carry the management company + association branding, never Portier369.
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Download, FileText, Printer } from 'lucide-react';

export type LedgerChargeRow = {
  date: string;
  description: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
};

export type LedgerPaymentRow = {
  date: string;
  method: string;
  reference: string;
  amount: number;
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
  const fileBase = `account-ledger-${new Date().toISOString().slice(0, 10)}`;

  function downloadCsv() {
    const lines: string[] = [];
    lines.push(`Account Ledger — ${ownerName}`);
    lines.push(`${companyName} — ${associationName}`);
    lines.push(`Generated ${stamp}`);
    lines.push('');
    lines.push('CHARGES');
    lines.push(['Date', 'Description', 'Amount', 'Paid', 'Balance', 'Status'].join(','));
    for (const c of charges) {
      lines.push([c.date, csvEscape(c.description), c.amount.toFixed(2), c.paid.toFixed(2), c.balance.toFixed(2), c.status].join(','));
    }
    lines.push('');
    lines.push('PAYMENTS');
    lines.push(['Date', 'Method', 'Reference', 'Amount'].join(','));
    for (const p of payments) {
      lines.push([p.date, csvEscape(p.method), csvEscape(p.reference), p.amount.toFixed(2)].join(','));
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
    doc.text(`${ownerName} · ${associationName}`, 14, 25);
    doc.text(`${companyName} · Generated ${stamp}`, 14, 30);
    doc.setTextColor(0);

    (doc as any).autoTable({
      startY: 36,
      head: [['Date', 'Description', 'Amount', 'Paid', 'Balance', 'Status']],
      body: charges.map((c) => [c.date, c.description, usd(c.amount), usd(c.paid), usd(c.balance), c.status]),
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [17, 24, 39] },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    });

    const afterCharges = (doc as any).lastAutoTable?.finalY ?? 40;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Payments', 14, afterCharges + 10);

    (doc as any).autoTable({
      startY: afterCharges + 13,
      head: [['Date', 'Method', 'Reference', 'Amount']],
      body: payments.map((p) => [p.date, p.method, p.reference, usd(p.amount)]),
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [17, 24, 39] },
      columnStyles: { 3: { halign: 'right' } },
    });

    const afterPayments = (doc as any).lastAutoTable?.finalY ?? 60;
    doc.setFontSize(11);
    doc.text(`Current balance: ${usd(totalBalance)}`, 14, afterPayments + 10);

    doc.save(`${fileBase}.pdf`);
  }

  const btn =
    'inline-flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50';

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className={btn}>
        <Printer className="h-4 w-4 text-gray-400" /> Print
      </button>
      <button type="button" onClick={downloadCsv} className={btn}>
        <Download className="h-4 w-4 text-gray-400" /> CSV
      </button>
      <button type="button" onClick={downloadPdf} className={btn}>
        <FileText className="h-4 w-4 text-gray-400" /> PDF
      </button>
    </div>
  );
}
