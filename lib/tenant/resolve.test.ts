import { describe, expect, it } from 'vitest';
import { NEUTRAL_COMPANY_NAME, tenantFromHeaders } from './resolve';

describe('tenant request headers', () => {
  it('maps trusted middleware headers and decodes branded values', () => {
    const headers = new Headers({
      'x-portfolio-id': 'p1',
      'x-portfolio-slug': 'cafe-management',
      'x-tenant-host': 'cafe-management.portier369.com',
      'x-portfolio-name': encodeURIComponent('Café Management'),
      'x-portfolio-logo': encodeURIComponent('https://cdn.example.com/café.svg'),
      'x-portfolio-color': '#123456',
    });

    expect(tenantFromHeaders(headers)).toMatchObject({
      portfolioId: 'p1',
      slug: 'cafe-management',
      hostname: 'cafe-management.portier369.com',
      companyName: 'Café Management',
      logoUrl: 'https://cdn.example.com/café.svg',
      brandColor: '#123456',
    });
  });

  it('never falls back to the platform name when the company name is missing or garbled', () => {
    for (const name of [null, '%E0%A4%A', encodeURIComponent('   ')]) {
      const headers = new Headers({ 'x-portfolio-id': 'p1' });
      if (name) headers.set('x-portfolio-name', name);
      const tenant = tenantFromHeaders(headers);
      expect(tenant?.companyName).toBe(NEUTRAL_COMPANY_NAME);
      expect(tenant?.companyName).not.toContain('Portier369');
    }
  });

  it('returns null without a middleware-resolved portfolio id', () => {
    expect(tenantFromHeaders(new Headers())).toBeNull();
  });
});
