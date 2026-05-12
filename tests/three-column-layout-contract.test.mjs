import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';

const appRoot = join(process.cwd(), 'app', '(app)');

function filesUnder(dir, name) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path, name));
    else if (entry === name) found.push(path);
  }
  return found;
}

function nearestLayout(pagePath) {
  let dir = dirname(pagePath);
  while (dir.startsWith(appRoot)) {
    const layout = join(dir, 'layout.tsx');
    if (existsSync(layout)) return layout;
    const next = dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return null;
}

test('pages do not add a fourth column when their route layout owns Tasks', () => {
  const offenders = [];

  for (const page of filesUnder(appRoot, 'page.tsx')) {
    const layout = nearestLayout(page);
    if (!layout) continue;

    const layoutSource = readFileSync(layout, 'utf8');
    if (!layoutSource.includes('<ContextPanel')) continue;

    const source = readFileSync(page, 'utf8');
    if (source.includes('<aside') || source.includes('ContextPanel')) {
      offenders.push(`${relative(process.cwd(), page)} is nested under ${relative(process.cwd(), layout)}`);
    }
  }

  assert.deepEqual(offenders, []);
});

test('workspace rail renders as a task menu, not another physical column', () => {
  const source = readFileSync(join(process.cwd(), 'components', 'workspace', 'shell.tsx'), 'utf8');

  assert.equal(source.includes('<aside'), false);
  assert.equal(source.includes('Task menu'), true);
});

test('workflow links live under Tasks, not separate workflow sections', () => {
  const offenders = [];

  for (const page of filesUnder(appRoot, 'page.tsx')) {
    const source = readFileSync(page, 'utf8');
    if (/PanelSection\s+title=["'][^"']*Workflows?["']/i.test(source)) {
      offenders.push(relative(process.cwd(), page));
    }
  }

  assert.deepEqual(offenders, []);
});

test('dashboard activity uses the full center column', () => {
  const source = readFileSync(join(appRoot, 'dashboard', 'page.tsx'), 'utf8');

  assert.equal(source.includes('mx-auto max-w-5xl'), false);
  assert.match(source, /className="[^"]*w-full[^"]*px-8[^"]*py-6/);
});
