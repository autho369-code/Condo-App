import { jsPDF } from 'jspdf';
import type { Guide, GuideBlock } from '@/lib/guides/content';

export type GuideBranding = {
  /** The management company; null renders neutral wording. */
  companyName: string | null;
  /** Where its staff sign in (always the Portier369 sign-in, via Supabase). */
  signInAddress: string | null;
  /** Where the Manager Runbook can always be opened again (company address). */
  runbookAddress?: string | null;
};

// The PDF's built-in Helvetica covers Windows-1252 only: arrows and the
// one-character ellipsis would print as garbage, so use ASCII stand-ins.
const printable = (text: string) => text.replace(/\s*→\s*/g, ' > ').replace(/…/g, '...');

const fill = (text: string, b: GuideBranding) =>
  printable(
    text
      .replaceAll('{company}', b.companyName ?? 'your management company')
      .replaceAll('{address}', b.signInAddress ?? 'your company\'s sign-in page')
      .replaceAll('{runbook}', b.runbookAddress ?? 'the link in your invitation email'),
  );

// Characters Windows-1252 (the built-in fonts' encoding) can print, beyond
// Latin-1: curly quotes, dashes, bullet, euro and a few more.
const CP1252_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');

/** Whether the built-in PDF font can draw every character of `text`. */
export function printableInBuiltInFont(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x20 && code <= 0x7e) continue;
    if (code >= 0xa0 && code <= 0xff) continue;
    if (CP1252_EXTRA.has(ch)) continue;
    return false;
  }
  return true;
}

/** A guide as a Letter-size PDF branded for one company. */
export function renderGuidePdf(guide: Guide, rawBranding: GuideBranding): Uint8Array {
  // A name the built-in font cannot draw (another script, emoji) would print
  // as garbage; use the neutral wording instead.
  const name = rawBranding.companyName?.trim() || null;
  const branding: GuideBranding = {
    ...rawBranding,
    companyName: name && printableInBuiltInFont(name) ? name : null,
  };
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' });
  const margin = 60;
  const width = 612;
  const height = 792;
  const contentWidth = width - margin * 2;
  const bottom = height - 70;
  const title = fill(guide.title, branding);
  const company = branding.companyName;
  let y = 0;

  const fit = (text: string, maxWidth: number) => {
    if (doc.getTextWidth(text) <= maxWidth) return text;
    let cut = text;
    while (cut.length > 1 && doc.getTextWidth(`${cut}...`) > maxWidth) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}...`;
  };
  // The style text is being written in, so a page break mid-paragraph can
  // put it back after drawing the page header.
  let current: [number, boolean, [number, number, number]] = [11, false, [31, 41, 55]];
  const apply = ([size, bold, color]: typeof current) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const style = (size: number, bold = false, color: [number, number, number] = [31, 41, 55]) => {
    current = [size, bold, color];
    apply(current);
  };
  const header = () => {
    apply([9, true, [31, 41, 55]]);
    doc.text(fit(company ? `${company} — ${title}` : title, contentWidth), margin, 40);
    doc.setDrawColor(209, 213, 219);
    doc.line(margin, 50, width - margin, 50);
  };
  const newPage = () => { doc.addPage(); header(); apply(current); y = 80; };
  const ensure = (needed: number) => { if (y + needed > bottom) newPage(); };
  const lines = (text: string, size: number, maxWidth = contentWidth): string[] => {
    doc.setFontSize(size);
    return doc.splitTextToSize(fill(text, branding), maxWidth);
  };
  const writeLines = (ls: string[], x: number, lead: number) => {
    for (const line of ls) { ensure(lead); doc.text(line, x, y); y += lead; }
  };

  // Cover
  style(13, true);
  doc.text(fit(company ?? '', contentWidth), margin, 150);
  style(28, true, [17, 24, 39]);
  const coverTitle = doc.splitTextToSize(title, contentWidth);
  doc.text(coverTitle, margin, 210);
  let cy = 210 + coverTitle.length * 34;
  style(13, false, [75, 85, 99]);
  const sub = doc.splitTextToSize(fill(guide.subtitle, branding), contentWidth);
  doc.text(sub, margin, cy); cy += sub.length * 18 + 18;
  style(10, false, [107, 114, 128]);
  doc.text(printable(guide.version), margin, cy); cy += 16;
  if (branding.signInAddress) doc.text(fit(`Sign in: ${branding.signInAddress}`, contentWidth), margin, cy);

  // Contents
  newPage();
  style(16, true, [17, 24, 39]);
  doc.text('Contents', margin, y); y += 28;
  style(11);
  guide.sections.forEach((s, i) => { ensure(18); doc.text(fit(`${i + 1}. ${fill(s.title, branding)}`, contentWidth), margin, y); y += 18; });

  // Sections
  const block = (b: GuideBlock) => {
    switch (b.kind) {
      case 'heading':
        ensure(34); y += 6; style(11.5, true, [17, 24, 39]);
        writeLines(lines(b.text, 11.5), margin, 16); y += 2; break;
      case 'paragraph':
        style(10.5); writeLines(lines(b.text, 10.5), margin, 15); y += 6; break;
      case 'bullets':
        for (const item of b.items) {
          style(10.5);
          const ls = lines(item, 10.5, contentWidth - 16);
          ensure(15);
          doc.text('•', margin + 2, y);
          writeLines(ls, margin + 16, 15);
          y += 3;
        }
        y += 4; break;
      case 'note': {
        style(10.5);
        const ls = lines(b.text, 10.5, contentWidth - 24);
        const boxH = 24 + ls.length * 15;
        ensure(boxH + 8);
        doc.setFillColor(243, 244, 246);
        doc.roundedRect(margin, y - 4, contentWidth, boxH, 6, 6, 'F');
        style(10.5, true, [17, 24, 39]);
        doc.text(fill(b.title, branding), margin + 12, y + 12);
        style(10.5);
        doc.text(ls, margin + 12, y + 28);
        y += boxH + 10; break;
      }
      case 'table': {
        const col = contentWidth * 0.46;
        const row = (a: string, c: string, bold: boolean) => {
          style(9.5, bold, bold ? [17, 24, 39] : [31, 41, 55]);
          const la = lines(a, 9.5, col - 10);
          const lc = lines(c, 9.5, contentWidth - col - 10);
          const rowH = Math.max(la.length, lc.length) * 13 + 8;
          if (y + rowH > bottom) {
            newPage();
            // Repeat the column headings on the continuation page.
            if (!bold) row(b.head[0], b.head[1], true);
          }
          style(9.5, bold, bold ? [17, 24, 39] : [31, 41, 55]);
          doc.text(la, margin + 4, y + 10);
          doc.text(lc, margin + col + 4, y + 10);
          y += rowH;
          doc.setDrawColor(229, 231, 235);
          doc.line(margin, y - 2, width - margin, y - 2);
        };
        ensure(40);
        row(b.head[0], b.head[1], true);
        for (const [a, c] of b.rows) row(a, c, false);
        y += 10; break;
      }
    }
  };
  guide.sections.forEach((s, i) => {
    ensure(60); y += 10;
    style(14, true, [17, 24, 39]);
    writeLines(lines(`${i + 1}. ${s.title}`, 14), margin, 20); y += 4;
    s.blocks.forEach(block);
  });

  // Footer: the only place the platform is named (allowed credit).
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, height - 46, width - margin, height - 46);
    style(8, false, [107, 114, 128]);
    doc.text('Powered by Portier369', margin, height - 30);
    doc.text(`Page ${page} of ${pages}`, width - margin, height - 30, { align: 'right' });
  }
  return new Uint8Array(doc.output('arraybuffer'));
}
