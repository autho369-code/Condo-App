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
