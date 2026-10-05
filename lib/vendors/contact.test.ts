import { describe, expect, it } from 'vitest';
import { primaryVendorEmail, vendorEmails } from './contact';

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
