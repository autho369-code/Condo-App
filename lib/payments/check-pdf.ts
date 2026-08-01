import { jsPDF } from 'jspdf';

export type PrintableCheck = {
  id: string;
  check_number: number;
  amount: number | string;
  payment_date: string;
  status: 'issued' | 'voided' | 'stop_payment';
  void_reason?: string | null;
  authorized_signer_label?: string | null;
  vendors?: {
    name?: string | null;
    address_street?: string | null;
    address_city?: string | null;
    address_state?: string | null;
    address_zip?: string | null;
  } | null;
  associations?: { name?: string | null } | null;
  bank_accounts?: {
    name?: string | null;
    bank_name?: string | null;
    company_name?: string | null;
    company_address?: string | null;
  } | null;
  payable_bills?: {
    bill_number?: string | null;
    memo?: string | null;
    bill_date?: string | null;
    due_date?: string | null;
    gl_accounts?: { number?: string | number | null; name?: string | null } | null;
  } | null;
};

function amountInWords(amount: number): string {
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  const ones = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const belowThousand = (value: number): string => {
    if (value < 20) return ones[value];
    if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? `-${ones[value % 10]}` : ''}`;
    return `${ones[Math.floor(value / 100)]} hundred${value % 100 ? ` ${belowThousand(value % 100)}` : ''}`;
  };
  const words = (value: number): string => {
    if (value === 0) return 'zero';
    if (value < 1_000) return belowThousand(value);
    if (value < 1_000_000) return `${belowThousand(Math.floor(value / 1_000))} thousand${value % 1_000 ? ` ${belowThousand(value % 1_000)}` : ''}`;
    return `${belowThousand(Math.floor(value / 1_000_000))} million${value % 1_000_000 ? ` ${words(value % 1_000_000)}` : ''}`;
  };
  const result = words(dollars);
  return `${result.charAt(0).toUpperCase()}${result.slice(1)} and ${String(cents).padStart(2, '0')}/100`;
}

function shortDate(value?: string | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}

function money(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function text(doc: jsPDF, value: unknown, x: number, y: number, options?: Parameters<jsPDF['text']>[3]) {
  doc.text(String(value ?? '-'), x, y, options);
}

export function generateCheckRunPdf(checks: PrintableCheck[]): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  checks.forEach((check, index) => {
    if (index > 0) doc.addPage('letter', 'portrait');
    const amount = Number(check.amount);
    const bank = check.bank_accounts;
    const vendor = check.vendors;
    const bill = check.payable_bills;
    const vendorCity = [vendor?.address_city, vendor?.address_state].filter(Boolean).join(', ');
    const vendorCityLine = `${vendorCity}${vendor?.address_zip ? ` ${vendor.address_zip}` : ''}`.trim();

    doc.setDrawColor(150);
    doc.setLineDashPattern([5, 4], 0);
    doc.line(0, 264, 612, 264);
    doc.line(0, 528, 612, 528);
    doc.setLineDashPattern([], 0);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    text(doc, bank?.company_name ?? 'Management company', 36, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const companyAddress = doc.splitTextToSize(bank?.company_address ?? '', 220);
    doc.text(companyAddress, 36, 47);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    text(doc, `#${check.check_number}`, 576, 34, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    text(doc, `Date: ${shortDate(check.payment_date)}`, 576, 50, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    text(doc, vendor?.name ?? 'Vendor', 64, 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (vendor?.address_street) text(doc, vendor.address_street, 64, 114);
    if (vendorCityLine) text(doc, vendorCityLine, 64, 128);

    doc.setFontSize(8);
    text(doc, 'PAY TO THE ORDER OF', 36, 168);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    text(doc, vendor?.name ?? 'Vendor', 145, 168);
    doc.line(140, 172, 455, 172);
    doc.rect(468, 150, 108, 26);
    text(doc, money(amount), 568, 168, { align: 'right' });
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    text(doc, amountInWords(amount), 40, 198);
    doc.line(36, 202, 526, 202);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    text(doc, 'DOLLARS', 576, 198, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    text(doc, `Memo: ${bill?.memo ?? check.associations?.name ?? '-'}`, 36, 231);
    doc.line(372, 226, 576, 226);
    text(doc, `Authorized signature - ${check.authorized_signer_label ?? 'signer configuration required'}`, 474, 239, { align: 'center' });
    doc.setTextColor(90);
    doc.setFontSize(7);
    text(doc, 'Use approved preprinted MICR check stock. No MICR encoding is generated by this PDF.', 306, 254, { align: 'center' });

    if (check.status !== 'issued') {
      doc.setTextColor(190, 45, 45);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(42);
      text(doc, check.status === 'stop_payment' ? 'STOP PAYMENT' : 'VOID', 306, 142, { align: 'center', angle: -18 });
      doc.setTextColor(0);
    }

    const drawStub = (top: number, title: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      text(doc, title, 36, top + 28);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      text(doc, `Check #${check.check_number}  |  ${shortDate(check.payment_date)}  |  ${money(amount)}`, 576, top + 28, { align: 'right' });
      doc.line(36, top + 36, 576, top + 36);
      text(doc, `Vendor: ${vendor?.name ?? '-'}`, 36, top + 58);
      text(doc, `Association: ${check.associations?.name ?? '-'}`, 320, top + 58);
      text(doc, `Invoice / ref: ${bill?.bill_number ?? '-'}`, 36, top + 79);
      text(doc, `Bill date: ${shortDate(bill?.bill_date)}`, 320, top + 79);
      text(doc, `Due date: ${shortDate(bill?.due_date)}`, 36, top + 100);
      text(doc, `GL: ${bill?.gl_accounts?.number ?? '-'} - ${bill?.gl_accounts?.name ?? '-'}`, 320, top + 100);
      text(doc, `Memo: ${bill?.memo ?? '-'}`, 36, top + 121);
      if (check.void_reason) text(doc, `Status reason: ${check.void_reason}`, 36, top + 142);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      text(doc, `Total paid: ${money(amount)}`, 576, top + 220, { align: 'right' });
    };
    drawStub(264, 'PAYMENT ADVICE - VENDOR COPY');
    drawStub(528, 'AP FILE COPY');
  });
  return new Uint8Array(doc.output('arraybuffer'));
}
