import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function source(path: string) {
  return readFileSync(resolve(root, path), 'utf8');
}

describe('placeholder safety', () => {
  it('does not expose unfinished payable tabs', () => {
    const billsPage = source('app/(app)/bills/page.tsx');

    expect(billsPage).not.toMatch(/coming soon/i);
    expect(billsPage).not.toContain("key: 'recurring'");
    expect(billsPage).not.toContain("key: 'loans'");
    expect(billsPage).not.toContain("key: 'online-payables'");
  });

  it('does not expose dead association task anchors', () => {
    const associationPanel = source('app/(app)/associations/_panel.tsx');
    const contextPanel = source('components/workspace/context-panel.tsx');

    expect(associationPanel).not.toMatch(/href="#/);
    expect(associationPanel).toContain('href="/reports/monthly-package"');
    expect(associationPanel).toContain('href="/reports/bulk-association"');
    expect(contextPanel).not.toContain('PLACEHOLDER_HREFS');
    expect(contextPanel).not.toContain("href.startsWith('/help/')");
    expect(contextPanel).not.toContain('Decorative close');
  });

  it('does not fabricate letter merge values', () => {
    const previewPage = source('app/(app)/letters/[id]/preview/page.tsx');
    const editor = source('components/letters/merge-field-editor.tsx');
    const unsafeExamples = [
      'Springfield',
      'Sarah Williams',
      'Robert Johnson',
      'PO Box 1234',
      "vals['amount_due'] = '$350.00'",
      "vals['owner_balance'] = '$1,250.00'",
    ];

    for (const example of unsafeExamples) {
      expect(previewPage).not.toContain(example);
      expect(editor).not.toContain(example);
    }
  });

  it('leaves unavailable merge fields visible for review', () => {
    const previewPage = source('app/(app)/letters/[id]/preview/page.tsx');

    expect(previewPage).toContain('return mergeValues[key] || `{{${key}}}`');
  });
});
