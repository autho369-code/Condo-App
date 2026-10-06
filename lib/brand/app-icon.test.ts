import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_ICON, companyIconBrand } from './app-icon';

let requestHeaders = new Headers();
vi.mock('next/headers', () => ({ headers: async () => requestHeaders }));
afterEach(() => { requestHeaders = new Headers(); });

describe('companyIconBrand', () => {
  it("uses the company's initial on its brand colour", () => {
    expect(companyIconBrand('Stellar Property Group', '#0F766E')).toEqual({ glyph: 'S', background: '#0F766E' });
    expect(companyIconBrand('  élan Residences', '#123abc')).toEqual({ glyph: 'É', background: '#123abc' });
    expect(companyIconBrand('369 Management', '#000000').glyph).toBe('3');
  });

  it('keeps the platform colour for a colour that is not a hex code', () => {
    expect(companyIconBrand('Stellar', 'red; background:url(x)').background).toBe(PLATFORM_ICON.background);
    expect(companyIconBrand('Stellar', null).background).toBe(PLATFORM_ICON.background);
  });

  it('falls back to the platform icon without a usable name', () => {
    expect(companyIconBrand('', '#0F766E')).toEqual(PLATFORM_ICON);
    expect(companyIconBrand('***', '#0F766E')).toEqual(PLATFORM_ICON);
  });
});

describe('requestIconBrand', () => {
  it("is the company's icon on its own address", async () => {
    requestHeaders = new Headers({
      'x-portfolio-id': 'p1',
      'x-portfolio-name': encodeURIComponent('Stellar Property Group'),
      'x-portfolio-color': '#0F766E',
    });
    const { requestIconBrand } = await import('./request-icon');
    expect(await requestIconBrand()).toEqual({ glyph: 'S', background: '#0F766E' });
  });

  it("is the platform's icon on the platform address", async () => {
    const { requestIconBrand } = await import('./request-icon');
    expect(await requestIconBrand()).toEqual(PLATFORM_ICON);
  });
});
