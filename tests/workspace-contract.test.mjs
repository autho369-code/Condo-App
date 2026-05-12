import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const contextPanel = readFileSync(new URL('../components/workspace/context-panel.tsx', import.meta.url), 'utf8');

test('context panel does not show nonfunctional close controls', () => {
  assert.equal(contextPanel.includes('Decorative close'), false);
  assert.equal(contextPanel.includes('aria-hidden="true">×</span>'), false);
});

test('context panel yields space to main workflows on smaller screens', () => {
  assert.equal(contextPanel.includes('hidden w-72'), true);
  assert.equal(contextPanel.includes('xl:block'), true);
});
