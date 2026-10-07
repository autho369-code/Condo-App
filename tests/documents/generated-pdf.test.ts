import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateDocumentPdf } from '@/lib/documents/generated-pdf';

describe('generated document PDFs', () => {
  it('creates a real Letter-size PDF with pagination metadata', () => {
    const pdf = generateDocumentPdf({
      subject: 'Annual assessment notice',
      associationName: 'Harbor View Staging HOA',
      preparedFor: ['Avery Alpha'],
      body: Array.from({ length: 120 }, (_, index) => `Document line ${index + 1}`).join('\n'),
      generatedAt: new Date('2026-07-30T12:00:00Z'),
    });
    const bytes = Buffer.from(pdf);
    const source = bytes.toString('latin1');
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(bytes.length).toBeGreaterThan(5_000);
    expect((source.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });

  it("heads every page with the management company, never the platform", () => {
    const text = (input: Parameters<typeof generateDocumentPdf>[0]) => Buffer.from(generateDocumentPdf(input)).toString('latin1');
    const branded = text({ subject: 'Notice', body: 'Hello', associationName: 'Harbor View HOA', companyName: 'Stellar Property Group' });
    expect(branded).toContain('(Stellar Property Group)');
    expect(branded).toContain('(Harbor View HOA)');
    expect(branded).not.toContain('(PORTIER369)');
    expect(branded).toContain('(Generated securely by Portier369)');
    // No company name: the association heads the page on its own.
    const unbranded = text({ subject: 'Notice', body: 'Hello', associationName: 'Harbor View HOA' });
    expect(unbranded).toContain('(Harbor View HOA)');
    expect(unbranded).not.toContain('(PORTIER369)');
  });

  it('shortens long names so the header labels never overlap', () => {
    const longCompany = 'Stellar Property Group and Associates Community Management Services International';
    const longAssociation = 'The Residences at Harbor View Condominium Owners Association of Annapolis';
    const src = Buffer.from(generateDocumentPdf({ subject: 'Notice', body: 'Hello', associationName: longAssociation, companyName: longCompany })).toString('latin1');
    expect(src).not.toContain(`(${longCompany})`);
    expect(src).not.toContain(`(${longAssociation})`);
    expect(src).toMatch(/\(Stellar Property Group[^)]*\.\.\.\)/);
    expect(src).toMatch(/\(The Residences at[^)]*\.\.\.\)/);
  });

  it('keeps body text styling on continuation pages', () => {
    const body = Array.from({ length: 120 }, (_, index) => `Document line ${index + 1}`).join('\n');
    for (const companyName of [null, 'Stellar Property Group']) {
      const src = Buffer.from(generateDocumentPdf({ subject: 'Notice', body, associationName: 'Harbor View HOA', companyName })).toString('latin1');
      const pages = (src.match(/\/Type \/Page\b/g) ?? []).length;
      expect(pages).toBeGreaterThan(1);
      // The 11pt body font is set again after every page header.
      expect((src.match(/ 11 Tf/g) ?? []).length).toBeGreaterThanOrEqual(pages);
    }
  });

  it('stores scoped PDFs through a guarded server action instead of empty document rows', () => {
    const action = readFileSync(resolve('lib/rpcs/documents.ts'), 'utf8');
    const page = readFileSync(resolve('app/(app)/documents/generate/page.tsx'), 'utf8');
    expect(action).toContain('await requireStaff()');
    expect(action).toContain("contentType: 'application/pdf'");
    expect(action).toContain('associations/${associationId}/generated/');
    expect(action).toContain("doc_type: 'other'");
    expect(page).toContain('generateAndStoreDocument');
    expect(page).not.toContain("file_url: ''");
    expect(page).toContain('No email is sent until the notice is approved and sent.');
  });
});
