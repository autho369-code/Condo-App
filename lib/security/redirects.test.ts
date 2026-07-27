import { describe, expect, it } from 'vitest';
import { safeInternalNext } from '@/lib/security/redirects';

describe('safeInternalNext', () => {
  it('preserves legitimate local deep links', () => {
    expect(safeInternalNext('/reports?tab=open#today')).toBe('/reports?tab=open#today');
  });

  it.each([
    'https://bad.example/dashboard',
    '//bad.example/dashboard',
    '/\\bad.example/dashboard',
    '/%2f%2fbad.example/dashboard',
    '/%255c%255cbad.example/dashboard',
    '/reports%0d%0aLocation:%20//bad.example',
  ])('rejects external or parser-ambiguous destination %s', (value) => {
    expect(safeInternalNext(value)).toBeNull();
  });
});
