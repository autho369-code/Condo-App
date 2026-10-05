import { describe, expect, it } from 'vitest';
import { parseLabeledPhones } from '@/lib/contacts/labeled-phones';

describe('parseLabeledPhones', () => {
  it('strips a single label', () => {
    expect(parseLabeledPhones('Phone: (312) 859-7024')).toEqual({
      primary: '(312) 859-7024',
      entries: [{ number: '(312) 859-7024', type: 'phone' }],
    });
  });

  it('splits several labeled numbers and prefers mobile as primary', () => {
    const r = parseLabeledPhones('Home: (773) 599-6882, Mobile: (773) 829-7314, Phone: (312) 576-0379');
    expect(r.primary).toBe('(773) 829-7314');
    expect(r.entries.map((e) => e.type)).toEqual(['home', 'mobile', 'phone']);
  });

  it('keeps an unlabeled number and drops duplicates and junk', () => {
    const r = parseLabeledPhones('312-555-0100; 312.555.0100, n/a');
    expect(r.entries).toEqual([{ number: '312-555-0100', type: null }]);
    expect(r.primary).toBe('312-555-0100');
  });

  it('returns nothing for empty input', () => {
    expect(parseLabeledPhones('  ')).toEqual({ primary: null, entries: [] });
  });
});
