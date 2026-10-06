import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DRAWABLE_GLYPH, DRAWABLE_TEXT, PLATFORM_ICON, companyIconBrand, glyphColorFor } from './app-icon';

/** Code points in a TrueType font's format-4 cmap. */
function fontCodePoints(path: string): (cp: number) => boolean {
  const buf = readFileSync(path);
  let cmap = 0;
  for (let i = 0; i < buf.readUInt16BE(4); i++) {
    const rec = 12 + i * 16;
    if (buf.toString('ascii', rec, rec + 4) === 'cmap') cmap = buf.readUInt32BE(rec + 8);
  }
  let fmt4 = 0;
  for (let i = 0; i < buf.readUInt16BE(cmap + 2); i++) {
    const off = cmap + buf.readUInt32BE(cmap + 4 + i * 8 + 4);
    if (buf.readUInt16BE(off) === 4) { fmt4 = off; break; }
  }
  const segX2 = buf.readUInt16BE(fmt4 + 6);
  const ends = fmt4 + 14;
  const starts = ends + segX2 + 2;
  return (cp) => {
    for (let i = 0; i < segX2 / 2; i++) {
      if (cp >= buf.readUInt16BE(starts + i * 2) && cp <= buf.readUInt16BE(ends + i * 2)) return true;
    }
    return false;
  };
}

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
    expect(companyIconBrand('Łódź Housing', '#0F766E')).toEqual(PLATFORM_ICON);
    expect(companyIconBrand('Ārija', '#0F766E')).toEqual(PLATFORM_ICON);
  });

  it("only allows initials the renderer's bundled font contains", () => {
    const ogDir = dirname(createRequire(import.meta.url).resolve('next/dist/compiled/@vercel/og/package.json'));
    const has = fontCodePoints(join(ogDir, 'noto-sans-v27-latin-regular.ttf'));
    const allowed = Array.from({ length: 0x250 }, (_, cp) => String.fromCodePoint(cp)).filter((ch) => DRAWABLE_GLYPH.test(ch));
    expect(allowed.length).toBeGreaterThan(60);
    expect(allowed.filter((ch) => !has(ch.codePointAt(0)!))).toEqual([]);

    // Company names on link-preview cards: every character the text check accepts.
    const textChars = Array.from({ length: 0x2100 }, (_, cp) => String.fromCodePoint(cp)).filter((ch) => DRAWABLE_TEXT.test(ch));
    expect(textChars.filter((ch) => !has(ch.codePointAt(0)!))).toEqual([]);
    expect(DRAWABLE_TEXT.test('Stellar Property Group, Inc. — Élan & Co’s')).toBe(true);
    expect(DRAWABLE_TEXT.test('中华物业')).toBe(false);
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
