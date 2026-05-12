import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const workOrdersPage = readFileSync(new URL('../app/(app)/work-orders/page.tsx', import.meta.url), 'utf8');
const actionsSource = readFileSync(new URL('../lib/rpcs/work-orders.ts', import.meta.url), 'utf8');
const newRoute = new URL('../app/(app)/work-orders/new/page.tsx', import.meta.url);

test('new work order link resolves to a real route', () => {
  assert.equal(workOrdersPage.includes('href="/work-orders/new"'), true, 'work orders list should expose the new route');
  assert.equal(existsSync(newRoute), true, '/work-orders/new route should exist');
});

test('new work order route has a direct create action', () => {
  assert.equal(actionsSource.includes('createWorkOrder('), true, 'work order actions should include createWorkOrder');
});
