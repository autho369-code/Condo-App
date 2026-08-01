import { describe, expect, it } from 'vitest';
import { tenantFromHeaders } from './resolve';

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

  it('returns null without a middleware-resolved portfolio id', () => {
    expect(tenantFromHeaders(new Headers())).toBeNull();
  });
});
