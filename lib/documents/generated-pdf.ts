import { jsPDF } from 'jspdf';

export type GeneratedDocumentPdfInput = {
  subject: string;
  body: string;
  associationName: string;
  /** The management company the letter comes from (white label: never the platform). */
  companyName?: string | null;
  preparedFor?: string[];
  generatedAt?: Date;
};

function plainText(value: string): string {
  return value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function generateDocumentPdf(input: GeneratedDocumentPdfInput): Uint8Array {
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const margin = 54;
  const width = 612;
  const height = 792;
  const contentWidth = width - margin * 2;
  const generatedAt = input.generatedAt ?? new Date();

  // The sender is the management company; with no company name the
  // association stands alone. Only the footer credits the platform.
  const company = input.companyName?.trim() || null;
  // Long names are shortened (with "...", which the built-in font has) so
  // the two never overlap.
  const fit = (text: string, maxWidth: number) => {
    if (doc.getTextWidth(text) <= maxWidth) return text;
    let cut = text;
    while (cut.length > 1 && doc.getTextWidth(`${cut}...`) > maxWidth) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}...`;
  };
  const setBodyStyle = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(31, 41, 55);
  };
  const drawHeader = () => {
    const column = company ? (contentWidth - 24) / 2 : contentWidth;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);
    doc.text(fit(company ?? input.associationName, column), margin, 42);
    if (company) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      doc.text(fit(input.associationName, column), width - margin, 42, { align: 'right' });
    }
    doc.setDrawColor(209, 213, 219);
    doc.line(margin, 52, width - margin, 52);
    // Continuation pages carry on with the body text right after this.
    setBodyStyle();
  };
  drawHeader();

  let y = 82;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(17, 24, 39);
  const titleLines = doc.splitTextToSize(plainText(input.subject), contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 20 + 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`Generated ${generatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, y);
  y += 18;
  if (input.preparedFor?.length) {
    const recipients = doc.splitTextToSize(`Prepared for: ${input.preparedFor.join(', ')}`, contentWidth);
    doc.text(recipients, margin, y);
    y += recipients.length * 12 + 12;
  } else {
    y += 8;
  }

  setBodyStyle();
  const paragraphs = plainText(input.body).split(/\n+/).filter(Boolean);
  for (const paragraph of paragraphs) {
    const lines: string[] = doc.splitTextToSize(paragraph, contentWidth);
    const paragraphHeight = lines.length * 16 + 10;
    if (y > 90 && y + paragraphHeight > height - 66) {
      doc.addPage();
      drawHeader();
      y = 76;
    }
    for (const line of lines) {
      if (y > height - 66) {
        doc.addPage();
        drawHeader();
        y = 76;
      }
      doc.text(line, margin, y);
      y += 16;
    }
    y += 10;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, height - 42, width - margin, height - 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Generated securely by Portier369', margin, height - 27);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 27, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
