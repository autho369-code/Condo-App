import { describe, expect, it } from 'vitest';
import { firstVendorPhone, phoneEntryValue, primaryVendorEmail, replaceFirstVendorPhone, vendorEmails } from './contact';

describe('vendor emails', () => {
  it('reads the plain-string shape the vendor form stores', () => {
    expect(vendorEmails(['ap@acme.com', ' ops@acme.com '])).toEqual(['ap@acme.com', 'ops@acme.com']);
    expect(primaryVendorEmail(['ap@acme.com', 'ops@acme.com'])).toBe('ap@acme.com');
  });

  it('reads the older object shape and prefers the work email', () => {
    expect(primaryVendorEmail([{ email: 'home@x.com', type: 'home' }, { email: 'work@x.com', type: 'work' }])).toBe('work@x.com');
    expect(vendorEmails([{ email: 'a@x.com' }, 'b@x.com'])).toEqual(['a@x.com', 'b@x.com']);
  });

  it('ignores blanks, non-addresses and non-arrays', () => {
    expect(vendorEmails(['', 'not-an-email', null, 7])).toEqual([]);
    expect(primaryVendorEmail(null)).toBeNull();
    expect(primaryVendorEmail('a@x.com')).toBeNull();
  });
});

describe('vendor phones', () => {
  it('reads plain strings and both object shapes', () => {
    expect(firstVendorPhone(['773-555-0100'])).toBe('773-555-0100');
    expect(firstVendorPhone([{ number: '1', type: 'work' }])).toBe('1');
    expect(firstVendorPhone([{ value: '2' }])).toBe('2');
    expect(firstVendorPhone([])).toBe('');
    expect(firstVendorPhone(null)).toBe('');
    expect(phoneEntryValue(7)).toBe('');
  });

  it('replaces the first entry keeping its shape and the rest of the list', () => {
    expect(replaceFirstVendorPhone(['old', 'second'], ' new ')).toEqual(['new', 'second']);
    expect(replaceFirstVendorPhone([{ number: 'old', type: 'cell' }], 'new')).toEqual([{ number: 'new', type: 'cell' }]);
    expect(replaceFirstVendorPhone([{ value: 'old' }], 'new')).toEqual([{ value: 'new' }]);
    expect(replaceFirstVendorPhone([], 'new')).toEqual(['new']);
  });

  it('removes only the first entry when cleared', () => {
    expect(replaceFirstVendorPhone(['a', 'b'], '')).toEqual(['b']);
  });
});
