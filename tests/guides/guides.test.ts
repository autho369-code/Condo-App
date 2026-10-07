import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { GUIDES } from '@/lib/guides/content';
import { printableInBuiltInFont, renderGuidePdf } from '@/lib/guides/pdf';

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: async () => ({ data: null, error: null }) }) }));

const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

describe('staff guides', () => {
  it('never name the platform in their content (white label)', () => {
    const all = JSON.stringify(GUIDES);
    expect(all).not.toMatch(/portier/i);
  });

  it("are branded with the company's name and its Portier369 sign-in address", () => {
    for (const guide of Object.values(GUIDES)) {
      const src = text(renderGuidePdf(guide, { companyName: 'Stellar Property Group', signInAddress: 'stellar.portier369.com/login' }));
      expect(src.startsWith('%PDF')).toBe(true);
      expect(src).toContain('Stellar Property Group');
      expect(src).toContain('stellar.portier369.com/login');
      // The only platform mention is the allowed footer credit.
      const mentions = src.match(/\([^)]*Portier369[^)]*\)/g) ?? [];
      expect(mentions.length).toBeGreaterThan(0);
      expect(mentions.every((m) => m === '(Powered by Portier369)')).toBe(true);
      // Characters the built-in font cannot draw are replaced.
      expect(src).not.toContain('→');
      expect(src).not.toContain('{company}');
      expect(src).not.toContain('{address}');
    }
  });

  it('fall back to neutral wording for names the built-in font cannot draw', () => {
    expect(printableInBuiltInFont('Société Générale — “Gestion”')).toBe(true);
    expect(printableInBuiltInFont('東京管理')).toBe(false);
    expect(printableInBuiltInFont('Sunny HOA 🌴')).toBe(false);
    const src = text(renderGuidePdf(GUIDES['manager-runbook'], { companyName: '東京管理', signInAddress: 'tokyo.portier369.com/login' }));
    expect(src).toContain('tokyo.portier369.com/login');
    expect(src).not.toContain('{company}');
  });

  it('use neutral wording when the company is unknown', () => {
    const src = text(renderGuidePdf(GUIDES['company-admin-guide'], { companyName: null, signInAddress: null }));
    expect(src).toContain('your management company');
    expect(src).not.toContain('{company}');
  });
});

describe('/manuals route', () => {
  const call = async (file: string, headers: Record<string, string> = {}) => {
    const { GET } = await import('../../app/manuals/[file]/route');
    return GET(new NextRequest(`https://stellar.example.test/manuals/${file}`, { headers }), { params: Promise.resolve({ file }) });
  };

  it('serves a guide branded from the company address it was opened on', async () => {
    const res = await call('manager-runbook.pdf', {
      'x-portfolio-id': 'p1',
      'x-portfolio-slug': 'stellar',
      'x-portfolio-name': encodeURIComponent('Stellar Property Group'),
      'x-tenant-host': 'portal.stellarpg.com',
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('cache-control')).toContain('no-store');
    const src = Buffer.from(await res.arrayBuffer()).toString('latin1');
    expect(src).toContain('Stellar Property Group');
    // Sign-in stays on the Portier369 workspace address, not the custom domain.
    expect(src).not.toContain('portal.stellarpg.com');
  });

  it('forwards the old platform-named files and refuses unknown ones', async () => {
    const moved = await call('Portier369-Manager-Runbook.pdf');
    expect(moved.status).toBe(308);
    expect(moved.headers.get('location')).toMatch(/\/manuals\/manager-runbook\.pdf$/);
    expect((await call('secrets.pdf')).status).toBe(404);
  });
});

describe('/manuals route without a company name', () => {
  it('uses neutral wording, never the platform name, when the company has no name', async () => {
    const { GET } = await import('../../app/manuals/[file]/route');
    const res = await GET(
      new NextRequest('https://stellar.example.test/manuals/manager-runbook.pdf', { headers: { 'x-portfolio-id': 'p1', 'x-portfolio-slug': 'stellar' } }),
      { params: Promise.resolve({ file: 'manager-runbook.pdf' }) },
    );
    const src = Buffer.from(await res.arrayBuffer()).toString('latin1');
    const mentions = src.match(/\([^)]*Portier369[^)]*\)/g) ?? [];
    expect(mentions.every((m) => m === '(Powered by Portier369)')).toBe(true);
  });
});
