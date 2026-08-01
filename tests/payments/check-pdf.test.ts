import { describe, expect, it } from 'vitest';
import { generateCheckRunPdf, type PrintableCheck } from '@/lib/payments/check-pdf';

const fixture = (number: number): PrintableCheck => ({
  id: `check-${number}`,
  check_number: number,
  amount: 750,
  payment_date: '2026-07-30',
  status: 'issued',
  authorized_signer_label: 'Authorized Treasurer',
  vendors: { name: 'Fixture Vendor', address_street: '410 Fixture Avenue', address_city: 'Seattle', address_state: 'WA', address_zip: '98101' },
  associations: { name: 'Fixture Association' },
  bank_accounts: { name: 'Operating', bank_name: 'Fixture Bank', company_name: 'Fixture Management', company_address: '100 Verification Way' },
  payable_bills: { bill_number: 'INV-1', memo: 'Utilities', bill_date: '2026-07-01', due_date: '2026-07-30', gl_accounts: { number: '6100', name: 'Utilities' } },
});

describe('check-run PDF', () => {
  it('creates a letter-size PDF with one page per immutable check', () => {
    const pdf = generateCheckRunPdf([fixture(5001), fixture(5002)]);
    expect(Buffer.from(pdf.subarray(0, 4)).toString()).toBe('%PDF');
    expect(pdf.byteLength).toBeGreaterThan(3_000);
    expect(Buffer.from(pdf).toString('latin1')).toContain('/Count 2');
  });

  it('does not emit fake MICR control glyphs', () => {
    const pdf = Buffer.from(generateCheckRunPdf([fixture(5001)])).toString('latin1');
    expect(pdf).not.toContain('⑆');
    expect(pdf).not.toContain('⑈');
  });
});
