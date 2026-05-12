import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('three-column layout contract', () => {
  it('does not render workspace rail as a fourth physical column', () => {
    const source = readFileSync(join(root, 'components', 'workspace', 'shell.tsx'), 'utf8');

    expect(source).not.toContain('<aside');
    expect(source).toContain('Task menu');
  });

  it('keeps dashboard activity in the center column', () => {
    const source = readFileSync(join(root, 'app', '(app)', 'dashboard', 'page.tsx'), 'utf8');

    expect(source).not.toContain('rail={<ActivityRail');
    expect(source).not.toContain('function ActivityRail');
    expect(source).toContain('<ActivitySection items={recentActivity ?? []} />');
  });
});
