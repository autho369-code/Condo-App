import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildInventory, check } from '../../scripts/redesign/inventory.mjs';

// The redesign is presentation only: every route, navigation entry, link,
// form/server action, submitted field, data source and guard recorded in the
// baseline (docs/redesign/baseline-inventory.json, taken before the redesign
// at 2fea8502) must still exist. Reworded button/confirmation labels are
// listed for review, not failed.
const baseline = JSON.parse(readFileSync(path.join(process.cwd(), 'docs/redesign/baseline-inventory.json'), 'utf8'));

describe('redesign parity with the baseline', () => {
  const current = buildInventory();
  const { missing, reworded } = check(baseline, current);

  it('keeps every route, navigation entry, link, action, field, data source and guard', () => {
    expect(missing).toEqual([]);
  });

  it('reports reworded labels for review', () => {
    if (reworded.length) console.info(`Reworded labels to review (${reworded.length}):\n${reworded.slice(0, 40).join('\n')}`);
    expect(Array.isArray(reworded)).toBe(true);
  });

  it('detects a removed capability (self-test)', () => {
    const copy = JSON.parse(JSON.stringify(current));
    const r = copy.routes.find((x: any) => x.caps.field.length > 0);
    r.caps.field = [];
    copy.navigation = copy.navigation.slice(1);
    const res = check(baseline, copy);
    expect(res.missing.some((m: string) => m.includes('field'))).toBe(true);
    expect(res.missing.some((m: string) => m.startsWith('navigation'))).toBe(true);
  });
});
