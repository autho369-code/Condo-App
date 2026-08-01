import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '@/lib/help/articles';

const root = process.cwd();

describe('contextual help content', () => {
  it('has a complete article for every linked help topic', () => {
    const panel = readFileSync(resolve(root, 'app/(app)/associations/_panel.tsx'), 'utf8');
    const linkedSlugs = [...panel.matchAll(/href="\/help\/([^"]+)"/g)].map((match) => match[1]);

    expect(linkedSlugs.length).toBeGreaterThan(0);
    expect([...new Set(linkedSlugs)].sort()).toEqual(Object.keys(HELP_ARTICLES).sort());
  });

  it('routes unknown or nested topics to the not-found boundary', () => {
    const page = readFileSync(resolve(root, 'app/help/[...slug]/page.tsx'), 'utf8');

    expect(page).toContain("import { notFound } from 'next/navigation'");
    expect(page).toContain('if (!article) notFound()');
    expect(page.toLowerCase()).not.toContain('coming soon');
  });

  it('does not classify implemented routes as placeholders', () => {
    const audit = readFileSync(resolve(root, 'scripts/audit-local-links.mjs'), 'utf8');

    expect(audit).not.toContain('placeholderHrefs');
    expect(audit).not.toContain("raw.startsWith('/help/')");
  });
});
