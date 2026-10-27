import { describe, expect, it } from 'vitest';
import { isValidRoutingNumber, parseRemittance, remittanceEmailHtml, lastFour } from '@/lib/billing/remittance';

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const good = { payee_name: 'Portier369, Inc.', bank_name: 'Test Bank', routing_number: '021000021', account_number: '123456789', account_type: 'checking', instructions: '' };

describe('ACH remittance', () => {
  it('checks the ABA routing checksum', () => {
    expect(isValidRoutingNumber('021000021')).toBe(true);
    expect(isValidRoutingNumber('011000015')).toBe(true);
    expect(isValidRoutingNumber('021000022')).toBe(false);
    expect(isValidRoutingNumber('12345678')).toBe(false);
    expect(isValidRoutingNumber('02100002a')).toBe(false);
  });

  it('cleans spaces and dashes and keeps a missing note as null', () => {
    const r = parseRemittance(form({ ...good, routing_number: '0210-00021', account_number: '1234 5678 9' }));
    expect(r).toEqual({ value: { ...good, routing_number: '021000021', account_number: '123456789', account_type: 'checking', instructions: null } });
  });

  it('refuses a bad routing number, a short account number and an unknown account type', () => {
    expect(parseRemittance(form({ ...good, routing_number: '021000022' }))).toEqual({ error: expect.stringMatching(/routing/i) });
    expect(parseRemittance(form({ ...good, account_number: '123' }))).toEqual({ error: expect.stringMatching(/account number/i) });
    expect(parseRemittance(form({ ...good, account_type: 'brokerage' }))).toEqual({ error: expect.stringMatching(/checking or savings/i) });
    expect(parseRemittance(form({ ...good, payee_name: ' ' }))).toEqual({ error: expect.stringMatching(/holder/i) });
  });

  it('builds the email block with the invoice number as the reference, escaping text', () => {
    const html = remittanceEmailHtml({ ...good, account_type: 'savings', instructions: 'Memo: <invoice #>' }, 'INV-7');
    expect(html).toContain('<strong>021000021</strong>');
    expect(html).toContain('<strong>123456789</strong>');
    expect(html).toContain('Savings');
    expect(html).toContain('<strong>INV-7</strong>');
    expect(html).toContain('Memo: &lt;invoice #&gt;');
    expect(html).not.toContain('<invoice');
    expect(lastFour('123456789')).toBe('6789');
  });
});
