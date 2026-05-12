import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('new work order route', () => {
  it('exists for links from work order task surfaces', () => {
    expect(existsSync(join(root, 'app', '(app)', 'work-orders', 'new', 'page.tsx'))).toBe(true);
  });

  it('uses a direct server action to create work orders', () => {
    const page = readFileSync(join(root, 'app', '(app)', 'work-orders', 'new', 'page.tsx'), 'utf8');
    const actions = readFileSync(join(root, 'lib', 'rpcs', 'work-orders.ts'), 'utf8');

    expect(page).toContain('createWorkOrder');
    expect(actions).toContain('export async function createWorkOrder');
  });
});
