import { describe, expect, it } from 'vitest';

import { associationDocumentPath, sanitizeDocumentFileName } from '@/lib/documents/association-documents';

describe('association document helpers', () => {
  it('sanitizes uploaded file names for storage paths', () => {
    expect(sanitizeDocumentFileName(' Board Minutes / April 2026.pdf ')).toBe('Board-Minutes-April-2026.pdf');
  });

  it('builds a portfolio and association scoped storage path', () => {
    expect(associationDocumentPath({
      associationId: 'assoc-1',
      fileName: 'Rules & Regs.pdf',
      portfolioId: 'portfolio-1',
      timestamp: 123,
    })).toBe('portfolio-1/assoc-1/123-Rules-Regs.pdf');
  });
});
