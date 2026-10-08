import { describe, expect, it } from 'vitest';
import { companyAddressRedirect, tokenMatchesAddress } from './token-company';

const PROD = 'https://portier369.com';
const APEX = 'portier369.com';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

function req(host: string, portfolioId?: string) {
  const h: Record<string, string> = { host };
  if (portfolioId) Object.assign(h, { 'x-portfolio-id': portfolioId, 'x-portfolio-slug': 'stellar', 'x-tenant-host': host });
  return new Headers(h);
}

describe('tokenMatchesAddress', () => {
  it("accepts the address's own company's token", () => {
    expect(tokenMatchesAddress(req('stellar.portier369.com', A), A)).toBe(true);
  });

  it("refuses another company's token, or one with no company, on a company's address", () => {
    expect(tokenMatchesAddress(req('stellar.portier369.com', A), B)).toBe(false);
    expect(tokenMatchesAddress(req('stellar.portier369.com', A), null)).toBe(false);
  });

  it('lets the platform address through (the page then moves to the company address)', () => {
    expect(tokenMatchesAddress(req('portier369.com'), B)).toBe(true);
  });
});

describe('companyAddressRedirect', () => {
  const company = { slug: 'stellar' };

  it("moves a platform-address visit to the company's address, keeping the notice", () => {
    expect(companyAddressRedirect(req('portier369.com'), company, '/sign/abc?done=Signed', PROD, APEX))
      .toBe('https://stellar.portier369.com/sign/abc?done=Signed');
    expect(companyAddressRedirect(req('www.portier369.com'), company, '/vendor-upload/abc', PROD, APEX))
      .toBe('https://stellar.portier369.com/vendor-upload/abc');
  });

  it("stays on a company's address, so it can't loop", () => {
    expect(companyAddressRedirect(req('stellar.portier369.com', A), company, '/sign/abc', PROD, APEX)).toBeNull();
  });

  it('stays when there is no company address to move to (previews, local runs, no slug)', () => {
    expect(companyAddressRedirect(req('localhost:3000'), company, '/sign/abc', 'http://localhost:3000', APEX)).toBeNull();
    expect(companyAddressRedirect(req('portier369.com'), {}, '/sign/abc', PROD, APEX)).toBeNull();
    expect(companyAddressRedirect(req('portier369.com'), null, '/sign/abc', PROD, APEX)).toBeNull();
  });
});
