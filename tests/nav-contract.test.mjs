import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../components/nav/items.ts', import.meta.url), 'utf8');

test('primary nav hides placeholder-only modules', () => {
  for (const hiddenRoute of ['/forms', '/inventory', '/projects', '/unit-turns']) {
    assert.equal(source.includes(`href: '${hiddenRoute}'`), false, `${hiddenRoute} should not be in primary nav`);
  }
});

test('primary nav keeps core working modules visible', () => {
  for (const route of ['/associations', '/owners', '/vendors', '/work-orders', '/violations', '/reports']) {
    assert.equal(source.includes(`href: '${route}'`), true, `${route} should stay in primary nav`);
  }
});
