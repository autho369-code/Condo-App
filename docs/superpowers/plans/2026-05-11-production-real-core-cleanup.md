# Production-Real Core Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the staff app surface production-honest by hiding placeholder-only modules, removing nonfunctional controls, and adding focused verification.

**Architecture:** Move sidebar navigation data into a testable module, keep the existing client sidebar behavior, and add a small Node-based test script that validates the production navigation contract without introducing a large test framework yet.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, Node.js built-in test runner, Supabase-backed server routes.

---

### Task 1: Make Sidebar Navigation Testable

**Files:**
- Create: `components/nav/items.ts`
- Modify: `components/nav/sidebar.tsx`

- [ ] **Step 1: Extract nav data**

Create `components/nav/items.ts`:

```typescript
export type NavItem = {
  label: string;
  href: string;
};

export type NavSection = {
  label: string;
  href?: string;
  children?: NavItem[];
};

export const NAV: NavSection[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Communication Center', href: '/communication-center' },
  {
    label: 'Calendar',
    children: [
      { label: 'Association Calendar', href: '/calendar' },
      { label: 'New Event', href: '/calendar/new' },
    ],
  },
  { label: 'Automation Center', href: '/automation-center' },
  { label: 'Associations', href: '/associations' },
  {
    label: 'People',
    children: [
      { label: 'Owners', href: '/owners' },
      { label: 'Tenants', href: '/owners?view=tenants' },
      { label: 'Vendors', href: '/vendors' },
    ],
  },
  {
    label: 'Accounting',
    children: [
      { label: 'Receivables', href: '/charges' },
      { label: 'Receipts', href: '/accounting/receivable-payments' },
      { label: 'Payables', href: '/accounting/payable-invoices' },
      { label: 'Bank Accounts', href: '/bank-accounts' },
      { label: 'Banking Activity', href: '/bank-accounts/activity' },
      { label: 'Journal Entries', href: '/journal-entries' },
      { label: 'Bank Transfers', href: '/bank-transfers' },
      { label: 'GL Accounts', href: '/gl-accounts' },
      { label: 'Diagnostics', href: '/diagnostics' },
      { label: 'Charge Categories', href: '/charge-categories' },
    ],
  },
  {
    label: 'Maintenance',
    children: [
      { label: 'Work Orders', href: '/work-orders' },
      { label: 'Recurring Work Orders', href: '/recurring-work-orders' },
      { label: 'Inspections', href: '/inspections' },
      { label: 'Purchase Orders', href: '/purchase-orders' },
      { label: 'Fixed Assets', href: '/fixed-assets' },
    ],
  },
  { label: 'Violations', href: '/violations' },
  {
    label: 'Reporting',
    children: [
      { label: 'Reports', href: '/reports' },
      { label: 'Scheduled Reports', href: '/scheduled-reports' },
      { label: 'Metrics', href: '/metrics' },
      { label: 'Surveys', href: '/surveys' },
    ],
  },
  {
    label: 'Communication',
    children: [
      { label: 'Letters', href: '/letters' },
      { label: 'Inbox', href: '/inbox' },
      { label: 'Send Email', href: '/send-email' },
    ],
  },
];
```

- [ ] **Step 2: Import nav data in sidebar**

In `components/nav/sidebar.tsx`, remove the inline `NAV` constant and add:

```typescript
import { NAV, type NavSection } from '@/components/nav/items';
```

Use `NavSection` instead of `any` where practical.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: build passes with the same route list.

### Task 2: Add Navigation Contract Test

**Files:**
- Create: `tests/nav-contract.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add test script**

Add this script to `package.json`:

```json
"test": "node --test"
```

- [ ] **Step 2: Add focused test**

Create `tests/nav-contract.test.mjs`:

```javascript
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
```

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: both nav contract tests pass.

### Task 3: Remove Fake Context Panel Close Control

**Files:**
- Modify: `components/workspace/context-panel.tsx`

- [ ] **Step 1: Remove decorative close glyph**

Change the panel header from:

```tsx
<div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
  <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
  <span className="cursor-pointer text-gray-400 hover:text-gray-600" aria-hidden="true">×</span>
</div>
```

To:

```tsx
<div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-5 py-3">
  <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
</div>
```

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: build passes.

### Task 4: Verify Final State

**Files:**
- No edits.

- [ ] **Step 1: Run tests**

Run: `npm test`

Expected: both nav contract tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: build passes.

- [ ] **Step 3: Review changed files**

Run: `git status --short -uall`

Expected: the changed files include the existing uncommitted project work plus these intentional additions/edits:

- `components/nav/items.ts`
- `components/nav/sidebar.tsx`
- `components/workspace/context-panel.tsx`
- `tests/nav-contract.test.mjs`
- `package.json`
- `docs/superpowers/specs/2026-05-11-production-real-core-cleanup-design.md`
- `docs/superpowers/plans/2026-05-11-production-real-core-cleanup.md`
