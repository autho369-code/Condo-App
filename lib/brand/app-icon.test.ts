import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_ICON, companyIconBrand, glyphColorFor } from './app-icon';

let requestHeaders = new Headers();
vi.mock('next/headers', () => ({ headers: async () => requestHeaders }));
afterEach(() => { requestHeaders = new Headers(); });

describe('companyIconBrand', () => {
  it("uses the company's initial on its brand colour", () => {
    expect(companyIconBrand('Stellar Property Group', '#0F766E')).toEqual({ glyph: 'S', background: '#0F766E', foreground: '#ffffff' });
    expect(companyIconBrand('  élan Residences', '#123abc')).toMatchObject({ glyph: 'É', background: '#123abc' });
    expect(companyIconBrand('369 Management', '#000000').glyph).toBe('3');
  });

  it('keeps the platform colour for a colour that is not a hex code', () => {
    expect(companyIconBrand('Stellar', 'red; background:url(x)').background).toBe(PLATFORM_ICON.background);
    expect(companyIconBrand('Stellar', null).background).toBe(PLATFORM_ICON.background);
  });

  it('keeps the initial visible on light brand colours', () => {
    expect(companyIconBrand('Stellar', '#FFFFFF').foreground).toBe('#111827');
    expect(companyIconBrand('Stellar', '#FDE047').foreground).toBe('#111827');
    expect(glyphColorFor('#1E3A5F')).toBe('#ffffff');
    expect(glyphColorFor('#10B981')).toBe('#111827');
  });

  it('keeps the platform icon for initials the icon font cannot draw', () => {
    expect(companyIconBrand('中华物业', '#0F766E')).toEqual(PLATFORM_ICON);
    expect(companyIconBrand('عقارات', '#0F766E')).toEqual(PLATFORM_ICON);
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
    expect(await requestIconBrand()).toEqual({ glyph: 'S', background: '#0F766E', foreground: '#ffffff' });
  });

  it("is the platform's icon on the platform address", async () => {
    const { requestIconBrand } = await import('./request-icon');
    expect(await requestIconBrand()).toEqual(PLATFORM_ICON);
  });
});
