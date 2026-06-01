# Command Center Operations Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a modern property-management operations UI that covers reports, violations, people, vendors, and banking foundations with Supabase-backed data and safe confirmation rules.

**Architecture:** Keep the existing Next.js App Router structure and evolve it module-by-module. Add focused data helpers under `lib/operations`, `lib/reports`, `lib/banking`, and `lib/people`, and add shared dense-workspace components under `components/operations` so pages stay small.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase SSR client, server actions, Vitest, React Testing Library.

## Completion Record

**Status:** Implemented and pushed.

**Branch:** `codex/operations-redesign-impl`

**Pull request:** https://github.com/autho369-code/Condo-App/pull/1

**Local frontend:** http://localhost:53106

**Verification:**
- `npm test` passed: 8 files, 14 tests.
- `npm run build` passed with `.env.local` loaded.
- Local production server is running with `next start --port 53106`.
- Smoke routes checked: `/login`, `/dashboard`, `/reports`, `/owners`, `/vendors`, `/violations`, `/bank-accounts`.

**Remaining product work:** deepen real production workflows beyond the current safe draft/preview shells, continue AppFolio report parity expansion, and perform authenticated browser QA after signing in.

---

## File Structure

- Modify `package.json`: add test scripts and test dependencies.
- Create `vitest.config.ts`: Vitest configuration for React component and pure helper tests.
- Create `tests/setup.ts`: shared DOM setup.
- Create `tests/fixtures/operations.ts`: deterministic row fixtures used by helper and component tests.
- Create `components/operations/status-chip.tsx`: reusable status chips for financial, compliance, and workflow states.
- Create `components/operations/filter-bar.tsx`: compact filter/search toolbar for dense lists.
- Create `components/operations/metric-strip.tsx`: KPI strip used by dashboard, reports, banking, and violations.
- Create `components/operations/data-workspace.tsx`: table-plus-toolbar wrapper with optional right focus panel.
- Modify `components/workspace/shell.tsx`: refresh shell styling and remove duplicated report workspace primitives.
- Modify `components/workspace/context-panel.tsx`: make the focus panel useful for tasks, reports, and help links.
- Create `lib/navigation/modules.ts`: single module navigation definition for app shell and command search.
- Modify `components/nav/sidebar.tsx`: render navigation from `lib/navigation/modules.ts`.
- Create `lib/operations/command-center.ts`: server-safe aggregators for command-center counts and links.
- Modify `app/(app)/dashboard/page.tsx`: replace current dashboard with command center.
- Create `lib/reports/catalog.ts`: report grouping, search, scope, and parameter helpers.
- Create `lib/reports/report-params.ts`: parse and serialize report parameters for `report_runs`, `saved_reports`, and `scheduled_reports`.
- Modify `app/(app)/reports/page.tsx`: modern report library with full active catalog coverage.
- Modify `app/(app)/reports/[slug]/page.tsx`: reusable report workspace with scope controls and preview states.
- Modify `lib/rpcs/reports.ts`: persist selected scope and safe output parameters.
- Create `lib/banking/bank-format.ts`: mask bank identifiers and normalize banking status labels.
- Create `lib/banking/activity.ts`: compute bank-account activity rows and running balances from existing payments, bills, transfers, and report rows where present.
- Modify `app/(app)/bank-accounts/page.tsx`: modern bank account registry with filters and task/report panel.
- Modify `app/(app)/bank-accounts/new/page.tsx`: sectioned new bank account workflow with masked-save guidance.
- Create `app/(app)/bank-accounts/activity/page.tsx`: bank account activity report workspace.
- Create `app/(app)/bank-accounts/deposits/new/page.tsx`: bank deposit scope picker and worksheet shell.
- Create `app/(app)/bank-accounts/feeds/page.tsx`: bank feed setup and monitoring shell.
- Create `app/(app)/bank-accounts/reconcile/page.tsx`: reconciliation summary workspace shell.
- Create `app/(app)/bank-accounts/adjustments/new/page.tsx`: bank adjustment form shell.
- Create `lib/violations/queries.ts`: violation list, filters, and detail data helpers.
- Modify `app/(app)/violations/page.tsx`: full violation list with filters and lifecycle metrics.
- Create `app/(app)/violations/new/page.tsx`: new violation workflow shell.
- Create `app/(app)/violations/[id]/page.tsx`: violation detail shell with updates and evidence.
- Create `lib/people/owner-workflows.ts`: owner ACH, portal activation, packets, forms, and agreement helper data.
- Modify `app/(app)/owners/page.tsx`: homeowner/owner directory improvements.
- Create `app/(app)/owners/ach/page.tsx`: owner ACH queue.
- Create `app/(app)/owners/activations/page.tsx`: portal activation queue.
- Create `app/(app)/owners/packets/page.tsx`: owner packet draft workspace.
- Create `app/(app)/owners/forms/page.tsx`: send owner form draft workspace.
- Create `app/(app)/owners/management-agreements/new/page.tsx`: management agreement stepper.
- Create `lib/vendors/workflows.ts`: vendor ACH, W-9, compliance, document reminder data helpers.
- Modify `app/(app)/vendors/page.tsx`: vendor directory with task/report links.
- Modify `app/(app)/vendors/new/page.tsx`: expanded vendor setup sections.
- Create `app/(app)/vendors/ach/page.tsx`: vendor ACH setup queue.
- Create `app/(app)/vendors/w9/page.tsx`: vendor W-9 request workspace.
- Create `app/(app)/vendors/compliance/page.tsx`: vendor document reminder workspace.
- Create `app/(app)/vendors/forms/page.tsx`: send vendor form draft workspace.

## Task 1: Test Harness And Deterministic Fixtures

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/fixtures/operations.ts`

- [x] **Step 1: Add test dependencies and scripts**

Update `package.json` scripts and devDependencies:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "types": "supabase gen types typescript --project-id termxngysvotnfbzbgrv --schema public > lib/types/database.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

- [x] **Step 2: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` updates and `npm` exits with code 0.

- [x] **Step 3: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
```

- [x] **Step 4: Add DOM setup**

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [x] **Step 5: Add fixtures**

Create `tests/fixtures/operations.ts`:

```ts
export const bankAccounts = [
  {
    id: 'bank-1',
    name: 'Winchester Court - Chase Checking',
    bank_name: 'Chase',
    account_number: '1234567890',
    routing_number: '071000013',
    payments_enabled: true,
    auto_reconciliation: false,
    last_reconciliation_date: '2026-03-31',
  },
  {
    id: 'bank-2',
    name: 'Reserve Savings',
    bank_name: 'Byline Bank',
    account_number: null,
    routing_number: null,
    payments_enabled: false,
    auto_reconciliation: false,
    last_reconciliation_date: null,
  },
];

export const reportDefinitions = [
  { id: 'r1', slug: 'bank_reconciliation', name: 'Bank Reconciliation', category: 'accounting', description: 'Reconcile bank accounts', active: true },
  { id: 'r2', slug: 'owner_ledger', name: 'Owner Ledger', category: 'association', description: 'Owner account activity', active: true },
  { id: 'r3', slug: 'violation_log', name: 'Violation Log', category: 'compliance', description: 'Violation activity', active: true },
];
```

- [x] **Step 6: Verify empty test suite works**

Run: `npm test -- --passWithNoTests`

Expected: PASS with no test files found or zero tests.

- [x] **Step 7: Commit**

Run:

```bash
git add package.json package-lock.json vitest.config.ts tests/setup.ts tests/fixtures/operations.ts
git commit -m "test: add vitest harness"
```

## Task 2: Dense Operations UI Primitives

**Files:**
- Create: `components/operations/status-chip.tsx`
- Create: `components/operations/filter-bar.tsx`
- Create: `components/operations/metric-strip.tsx`
- Create: `components/operations/data-workspace.tsx`
- Test: `tests/operations/components.test.tsx`

- [x] **Step 1: Write component tests**

Create `tests/operations/components.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusChip } from '@/components/operations/status-chip';
import { MetricStrip } from '@/components/operations/metric-strip';

describe('operations primitives', () => {
  it('renders a status chip with the provided label', () => {
    render(<StatusChip tone="success">Enabled</StatusChip>);
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('renders metrics with labels and values', () => {
    render(<MetricStrip metrics={[{ label: 'Open violations', value: 12 }, { label: 'Unreconciled', value: '$4,500' }]} />);
    expect(screen.getByText('Open violations')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Unreconciled')).toBeInTheDocument();
    expect(screen.getByText('$4,500')).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/operations/components.test.tsx`

Expected: FAIL because `components/operations/status-chip.tsx` does not exist.

- [x] **Step 3: Implement `StatusChip`**

Create `components/operations/status-chip.tsx`:

```tsx
import * as React from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const toneClass: Record<Tone, string> = {
  neutral: 'bg-gray-100 text-gray-700 ring-gray-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
};

export function StatusChip({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center rounded px-2 text-xs font-medium ring-1 ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
```

- [x] **Step 4: Implement `MetricStrip`**

Create `components/operations/metric-strip.tsx`:

```tsx
import * as React from 'react';

export type Metric = {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
};

export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded border border-gray-200 bg-white px-4 py-3">
          <div className="text-xs font-medium uppercase text-gray-500">{metric.label}</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-950">{metric.value}</div>
          {metric.sublabel && <div className="mt-1 text-xs text-gray-500">{metric.sublabel}</div>}
        </div>
      ))}
    </div>
  );
}
```

- [x] **Step 5: Implement `FilterBar`**

Create `components/operations/filter-bar.tsx`:

```tsx
import * as React from 'react';

export function FilterBar({
  action,
  children,
  searchName = 'q',
  searchDefault = '',
  searchPlaceholder = 'Search',
}: {
  action: string;
  children?: React.ReactNode;
  searchName?: string;
  searchDefault?: string;
  searchPlaceholder?: string;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-3">
      <label className="min-w-64 flex-1 text-xs font-medium uppercase text-gray-500">
        Search
        <input
          name={searchName}
          defaultValue={searchDefault}
          placeholder={searchPlaceholder}
          className="mt-1 h-9 w-full rounded border border-gray-300 px-3 text-sm normal-case text-gray-900"
        />
      </label>
      {children}
      <button type="submit" className="h-9 rounded bg-gray-950 px-4 text-sm font-medium text-white">
        Apply
      </button>
    </form>
  );
}
```

- [x] **Step 6: Implement `DataWorkspace`**

Create `components/operations/data-workspace.tsx`:

```tsx
import * as React from 'react';

export function DataWorkspace({
  title,
  description,
  actions,
  children,
  rail,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  rail?: React.ReactNode;
}) {
  return (
    <div className="flex h-full bg-gray-50">
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-6 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-950">{title}</h1>
            {description && <p className="mt-1 max-w-3xl text-sm text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
        {children}
      </main>
      {rail && <aside className="w-80 shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-5">{rail}</aside>}
    </div>
  );
}
```

- [x] **Step 7: Verify tests**

Run: `npm test -- tests/operations/components.test.tsx`

Expected: PASS.

- [x] **Step 8: Commit**

Run:

```bash
git add components/operations tests/operations/components.test.tsx
git commit -m "feat: add operations ui primitives"
```

## Task 3: Navigation And Shell Foundation

**Files:**
- Create: `lib/navigation/modules.ts`
- Modify: `components/nav/sidebar.tsx`
- Modify: `components/workspace/context-panel.tsx`
- Test: `tests/navigation/modules.test.ts`

- [x] **Step 1: Write navigation test**

Create `tests/navigation/modules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { appModules } from '@/lib/navigation/modules';

describe('appModules', () => {
  it('includes the core operating modules', () => {
    const labels = appModules.map((module) => module.label);
    expect(labels).toContain('Command');
    expect(labels).toContain('Associations');
    expect(labels).toContain('Accounting');
    expect(labels).toContain('Reports');
    expect(labels).toContain('Violations');
    expect(labels).toContain('People');
    expect(labels).toContain('Vendors');
  });
});
```

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/navigation/modules.test.ts`

Expected: FAIL because `lib/navigation/modules.ts` does not exist.

- [x] **Step 3: Add module definition**

Create `lib/navigation/modules.ts`:

```ts
export type AppModule = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
};

export const appModules: AppModule[] = [
  { label: 'Command', href: '/dashboard' },
  {
    label: 'Associations',
    href: '/associations',
    children: [
      { label: 'Directory', href: '/associations' },
      { label: 'New association', href: '/associations/new' },
      { label: 'Units', href: '/units' },
    ],
  },
  {
    label: 'Accounting',
    href: '/bank-accounts',
    children: [
      { label: 'Receivables', href: '/charges' },
      { label: 'Payables', href: '/bills' },
      { label: 'Bank accounts', href: '/bank-accounts' },
      { label: 'Journal entries', href: '/journal-entries' },
      { label: 'Bank transfers', href: '/bank-transfers' },
      { label: 'GL accounts', href: '/gl-accounts' },
      { label: 'Diagnostics', href: '/diagnostics' },
    ],
  },
  { label: 'Reports', href: '/reports' },
  { label: 'Violations', href: '/violations' },
  { label: 'People', href: '/owners' },
  { label: 'Vendors', href: '/vendors' },
  { label: 'Maintenance', href: '/work-orders' },
  { label: 'Communication', href: '/communication-center' },
  { label: 'Settings', href: '/settings' },
];
```

- [x] **Step 4: Update sidebar**

Modify `components/nav/sidebar.tsx` to import `appModules` and render links from the array. Preserve the existing visual brand and active-state logic.

Use this rendering core inside the component:

```tsx
import { appModules } from '@/lib/navigation/modules';

<nav className="space-y-1 px-3 py-4">
  {appModules.map((module) => (
    <Link
      key={module.href}
      href={module.href}
      className="flex h-9 items-center rounded px-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
    >
      {module.label}
    </Link>
  ))}
</nav>
```

- [x] **Step 5: Verify navigation test**

Run: `npm test -- tests/navigation/modules.test.ts`

Expected: PASS.

- [x] **Step 6: Verify build**

Run: `npm run build`

Expected: build completes without TypeScript errors.

- [x] **Step 7: Commit**

Run:

```bash
git add lib/navigation/modules.ts components/nav/sidebar.tsx components/workspace/context-panel.tsx tests/navigation/modules.test.ts
git commit -m "feat: define operations navigation"
```

## Task 4: Command Center Dashboard

**Files:**
- Create: `lib/operations/command-center.ts`
- Modify: `app/(app)/dashboard/page.tsx`
- Test: `tests/operations/command-center.test.ts`

- [x] **Step 1: Write aggregation tests**

Create `tests/operations/command-center.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildCommandMetrics } from '@/lib/operations/command-center';

describe('buildCommandMetrics', () => {
  it('returns command metrics in stable display order', () => {
    const metrics = buildCommandMetrics({
      openViolations: 4,
      overdueViolations: 1,
      pendingBills: 9,
      unreconciledBankAccounts: 3,
      scheduledReportsDue: 2,
      openWorkOrders: 8,
    });

    expect(metrics.map((metric) => metric.label)).toEqual([
      'Open violations',
      'Overdue violations',
      'Pending bills',
      'Unreconciled accounts',
      'Reports due',
      'Open work orders',
    ]);
    expect(metrics[0].href).toBe('/violations?status=open');
  });
});
```

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/operations/command-center.test.ts`

Expected: FAIL because `lib/operations/command-center.ts` does not exist.

- [x] **Step 3: Implement command helper**

Create `lib/operations/command-center.ts`:

```ts
export type CommandCounts = {
  openViolations: number;
  overdueViolations: number;
  pendingBills: number;
  unreconciledBankAccounts: number;
  scheduledReportsDue: number;
  openWorkOrders: number;
};

export function buildCommandMetrics(counts: CommandCounts) {
  return [
    { label: 'Open violations', value: counts.openViolations, href: '/violations?status=open' },
    { label: 'Overdue violations', value: counts.overdueViolations, href: '/violations?status=overdue' },
    { label: 'Pending bills', value: counts.pendingBills, href: '/bills?status=pending' },
    { label: 'Unreconciled accounts', value: counts.unreconciledBankAccounts, href: '/bank-accounts?filter=unreconciled' },
    { label: 'Reports due', value: counts.scheduledReportsDue, href: '/scheduled-reports' },
    { label: 'Open work orders', value: counts.openWorkOrders, href: '/work-orders?status=open' },
  ];
}
```

- [x] **Step 4: Update dashboard page**

Modify `app/(app)/dashboard/page.tsx` to query counts with Supabase and render `DataWorkspace` plus `MetricStrip`. Use existing `requireStaff()` before queries. Use `count: 'exact', head: true` queries for count-only panels.

Core query pattern:

```ts
const { count: openViolations } = await supabase
  .from('violations')
  .select('id', { count: 'exact', head: true })
  .is('archived_at', null)
  .not('status', 'in', '("closed","resolved")');
```

- [x] **Step 5: Verify tests**

Run: `npm test -- tests/operations/command-center.test.ts`

Expected: PASS.

- [x] **Step 6: Verify build**

Run: `npm run build`

Expected: PASS.

- [x] **Step 7: Commit**

Run:

```bash
git add lib/operations/command-center.ts app/(app)/dashboard/page.tsx tests/operations/command-center.test.ts
git commit -m "feat: add command center metrics"
```

## Task 5: Report Catalog And Scoped Report Workspace

**Files:**
- Create: `lib/reports/catalog.ts`
- Create: `lib/reports/report-params.ts`
- Modify: `app/(app)/reports/page.tsx`
- Modify: `app/(app)/reports/[slug]/page.tsx`
- Modify: `lib/rpcs/reports.ts`
- Test: `tests/reports/catalog.test.ts`

- [x] **Step 1: Write report helper tests**

Create `tests/reports/catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { groupReports, serializeReportParams } from '@/lib/reports/catalog';
import { reportDefinitions } from '../fixtures/operations';

describe('report catalog helpers', () => {
  it('groups active reports by category', () => {
    const groups = groupReports(reportDefinitions);
    expect(groups.map((group) => group.title)).toEqual(['Accounting', 'Association', 'Compliance']);
  });

  it('serializes explicit scope into report parameters', () => {
    const params = serializeReportParams({
      scope: 'association',
      associationId: 'assoc-1',
      ownerId: '',
      unitId: '',
      dateFrom: '2026-04-01',
      dateTo: '2026-04-30',
    });
    expect(params).toEqual({
      scope: 'association',
      association_id: 'assoc-1',
      date_from: '2026-04-01',
      date_to: '2026-04-30',
    });
  });
});
```

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/reports/catalog.test.ts`

Expected: FAIL because `lib/reports/catalog.ts` does not exist.

- [x] **Step 3: Implement report helpers**

Create `lib/reports/catalog.ts`:

```ts
type ReportDefinition = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  active?: boolean;
};

const categoryLabels: Record<string, string> = {
  accounting: 'Accounting',
  association: 'Association',
  compliance: 'Compliance',
  maintenance: 'Maintenance',
  people: 'People',
  property_unit: 'Property And Unit',
  communication: 'Communication',
};

export function groupReports(definitions: ReportDefinition[]) {
  const grouped = new Map<string, ReportDefinition[]>();
  for (const definition of definitions.filter((row) => row.active !== false)) {
    const key = definition.category;
    grouped.set(key, [...(grouped.get(key) ?? []), definition]);
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => categoryLabels[a]?.localeCompare(categoryLabels[b] ?? b) ?? a.localeCompare(b))
    .map(([category, items]) => ({
      category,
      title: categoryLabels[category] ?? category,
      items: items.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export type ReportScopeInput = {
  scope: 'portfolio' | 'association' | 'owner' | 'unit';
  associationId?: string;
  ownerId?: string;
  unitId?: string;
  dateFrom?: string;
  dateTo?: string;
};

export function serializeReportParams(input: ReportScopeInput) {
  const params: Record<string, string> = { scope: input.scope };
  if (input.associationId) params.association_id = input.associationId;
  if (input.ownerId) params.owner_id = input.ownerId;
  if (input.unitId) params.unit_id = input.unitId;
  if (input.dateFrom) params.date_from = input.dateFrom;
  if (input.dateTo) params.date_to = input.dateTo;
  return params;
}
```

- [x] **Step 4: Re-export params helper**

Create `lib/reports/report-params.ts`:

```ts
export { serializeReportParams } from './catalog';
export type { ReportScopeInput } from './catalog';
```

- [x] **Step 5: Update report pages**

Modify `app/(app)/reports/page.tsx` to call `groupReports(defs ?? [])` and render categories using `DataWorkspace`. Keep fetching all active `report_definitions`; add a visible catalog count that must match the active count.

Modify `app/(app)/reports/[slug]/page.tsx` so the filter form includes:

```tsx
<input type="hidden" name="definition_id" value={definition.id} />
<select name="param_scope" defaultValue="association">
  <option value="portfolio">Portfolio</option>
  <option value="association">Association</option>
  <option value="owner">Owner</option>
  <option value="unit">Unit</option>
</select>
<input type="date" name="param_date_from" />
<input type="date" name="param_date_to" />
```

- [x] **Step 6: Preserve scope in queued report runs**

Modify `lib/rpcs/reports.ts` so `queueReport` copies all `param_` values into `parameters` and rejects a missing `param_scope` with a useful error:

```ts
if (!params.scope) {
  return { error: 'Report scope is required' };
}
```

- [x] **Step 7: Verify tests**

Run: `npm test -- tests/reports/catalog.test.ts`

Expected: PASS.

- [x] **Step 8: Verify build**

Run: `npm run build`

Expected: PASS.

- [x] **Step 9: Commit**

Run:

```bash
git add lib/reports app/(app)/reports/page.tsx app/(app)/reports/[slug]/page.tsx lib/rpcs/reports.ts tests/reports/catalog.test.ts
git commit -m "feat: add scoped reports workspace"
```

## Task 6: Banking Registry And Analysis Workspaces

**Files:**
- Create: `lib/banking/bank-format.ts`
- Create: `lib/banking/activity.ts`
- Modify: `app/(app)/bank-accounts/page.tsx`
- Modify: `app/(app)/bank-accounts/new/page.tsx`
- Create: `app/(app)/bank-accounts/activity/page.tsx`
- Create: `app/(app)/bank-accounts/deposits/new/page.tsx`
- Create: `app/(app)/bank-accounts/feeds/page.tsx`
- Create: `app/(app)/bank-accounts/reconcile/page.tsx`
- Create: `app/(app)/bank-accounts/adjustments/new/page.tsx`
- Test: `tests/banking/bank-format.test.ts`

- [x] **Step 1: Write banking helper tests**

Create `tests/banking/bank-format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { maskBankNumber, buildActivityRows } from '@/lib/banking/bank-format';

describe('bank formatting helpers', () => {
  it('masks account numbers', () => {
    expect(maskBankNumber('1234567890')).toBe('******7890');
    expect(maskBankNumber(null)).toBe('Not provided');
  });

  it('builds running balances in date order', () => {
    const rows = buildActivityRows([
      { id: '1', date: '2026-04-02', cashIn: 100, cashOut: 0, description: 'Deposit' },
      { id: '2', date: '2026-04-01', cashIn: 0, cashOut: 25, description: 'Check' },
    ], 500);
    expect(rows.map((row) => row.runningBalance)).toEqual([475, 575]);
  });
});
```

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/banking/bank-format.test.ts`

Expected: FAIL because `lib/banking/bank-format.ts` does not exist.

- [x] **Step 3: Implement bank helpers**

Create `lib/banking/bank-format.ts`:

```ts
export function maskBankNumber(value: string | null | undefined) {
  if (!value) return 'Not provided';
  const lastFour = value.slice(-4);
  return `${'*'.repeat(Math.max(value.length - 4, 0))}${lastFour}`;
}

export type ActivityInput = {
  id: string;
  date: string;
  cashIn: number;
  cashOut: number;
  description: string;
};

export function buildActivityRows(rows: ActivityInput[], openingBalance = 0) {
  let balance = openingBalance;
  return [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      balance = balance + row.cashIn - row.cashOut;
      return { ...row, runningBalance: balance };
    });
}
```

- [x] **Step 4: Add activity data helper**

Create `lib/banking/activity.ts`:

```ts
import { buildActivityRows } from './bank-format';

export type BankActivitySourceRow = {
  id: string;
  date: string;
  payee: string;
  transactionType: string;
  reference: string;
  cleared: boolean;
  cashIn: number;
  cashOut: number;
  description: string;
};

export function toActivityRows(rows: BankActivitySourceRow[], openingBalance = 0) {
  return buildActivityRows(rows, openingBalance);
}
```

- [x] **Step 5: Update bank account registry**

Modify `app/(app)/bank-accounts/page.tsx` to:

- Use `DataWorkspace`.
- Add filters for account name and bank.
- Display masked account number with `maskBankNumber`.
- Show payments enabled and auto reconciliation with `StatusChip`.
- Add right rail links for New Bank Account, New Bank Deposit, Bank Feed, Reconcile, Bank Account Activity, Check Register, Deposit Register, and Bank Reconciliation.

- [x] **Step 6: Update new bank account page**

Modify `app/(app)/bank-accounts/new/page.tsx` into sections named Bank Information, Legal Entity, Ownership, Accounting, Check Printing, Notes, and Attachments. Keep `createBankAccount` as the server action for the first pass and add copy that account identifiers are masked after save.

- [x] **Step 7: Add banking workspace shells**

Create these pages with `DataWorkspace`, `FilterBar`, `MetricStrip`, and no external transmission:

- `app/(app)/bank-accounts/activity/page.tsx`: bank/date filters and transaction table shell.
- `app/(app)/bank-accounts/deposits/new/page.tsx`: bank account selector, unit/association selector, search button, empty state.
- `app/(app)/bank-accounts/feeds/page.tsx`: account selector, last sync status, imported transaction queue shell, confirmation copy for provider linking.
- `app/(app)/bank-accounts/reconcile/page.tsx`: statement inputs, ending/cleared/adjusted cards, deposits/credits table, checks/payments table, save and reconcile buttons.
- `app/(app)/bank-accounts/adjustments/new/page.tsx`: amount, adjustment date, description, GL-impact warning, history, notes, attachments.

- [x] **Step 8: Verify tests**

Run: `npm test -- tests/banking/bank-format.test.ts`

Expected: PASS.

- [x] **Step 9: Verify build**

Run: `npm run build`

Expected: PASS.

- [x] **Step 10: Commit**

Run:

```bash
git add lib/banking app/(app)/bank-accounts tests/banking/bank-format.test.ts
git commit -m "feat: add banking operations workspaces"
```

## Task 7: Violations Center

**Files:**
- Create: `lib/violations/queries.ts`
- Modify: `app/(app)/violations/page.tsx`
- Create: `app/(app)/violations/new/page.tsx`
- Create: `app/(app)/violations/[id]/page.tsx`
- Test: `tests/violations/filters.test.ts`

- [x] **Step 1: Write filter test**

Create `tests/violations/filters.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildViolationFilterSummary } from '@/lib/violations/queries';

describe('buildViolationFilterSummary', () => {
  it('summarizes active filters', () => {
    expect(buildViolationFilterSummary({ associationId: 'a1', status: 'open', escalation: 'overdue' })).toEqual([
      'Association selected',
      'Status: open',
      'Escalation: overdue',
    ]);
  });
});
```

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/violations/filters.test.ts`

Expected: FAIL because `lib/violations/queries.ts` does not exist.

- [x] **Step 3: Implement violation helper**

Create `lib/violations/queries.ts`:

```ts
export type ViolationFilters = {
  associationId?: string;
  status?: string;
  escalation?: string;
};

export function buildViolationFilterSummary(filters: ViolationFilters) {
  const summary: string[] = [];
  if (filters.associationId) summary.push('Association selected');
  if (filters.status) summary.push(`Status: ${filters.status}`);
  if (filters.escalation) summary.push(`Escalation: ${filters.escalation}`);
  return summary;
}
```

- [x] **Step 4: Update violations list**

Modify `app/(app)/violations/page.tsx` to use `DataWorkspace`, `MetricStrip`, `FilterBar`, and `ContextPanel`. Include filters for association, status, escalation, rule/type, unit/owner search, and date observed. Keep existing Supabase query columns and add links to `/violations/[id]`.

- [x] **Step 5: Add new violation page**

Create `app/(app)/violations/new/page.tsx` with a sectioned form:

- Association, unit, owner.
- Rule/type and title.
- Observed date, due date, cure deadline.
- Status and escalation.
- Fine amount.
- Evidence/attachments shell.
- Draft notice preview shell with no send action.

- [x] **Step 6: Add violation detail page**

Create `app/(app)/violations/[id]/page.tsx` that loads one violation, its association/unit/owner, `violation_updates`, and related documents. Render timeline, evidence, notice status, follow-up steps, and actions that stop at draft/preview.

- [x] **Step 7: Verify tests**

Run: `npm test -- tests/violations/filters.test.ts`

Expected: PASS.

- [x] **Step 8: Verify build**

Run: `npm run build`

Expected: PASS.

- [x] **Step 9: Commit**

Run:

```bash
git add lib/violations app/(app)/violations tests/violations/filters.test.ts
git commit -m "feat: add violations center"
```

## Task 8: Owner And Vendor Workflow Foundations

**Files:**
- Create: `lib/people/owner-workflows.ts`
- Create: `lib/vendors/workflows.ts`
- Modify: `app/(app)/owners/page.tsx`
- Create: `app/(app)/owners/ach/page.tsx`
- Create: `app/(app)/owners/activations/page.tsx`
- Create: `app/(app)/owners/packets/page.tsx`
- Create: `app/(app)/owners/forms/page.tsx`
- Create: `app/(app)/owners/management-agreements/new/page.tsx`
- Modify: `app/(app)/vendors/page.tsx`
- Modify: `app/(app)/vendors/new/page.tsx`
- Create: `app/(app)/vendors/ach/page.tsx`
- Create: `app/(app)/vendors/w9/page.tsx`
- Create: `app/(app)/vendors/compliance/page.tsx`
- Create: `app/(app)/vendors/forms/page.tsx`
- Test: `tests/workflows/safe-actions.test.ts`

- [x] **Step 1: Write safe-action tests**

Create `tests/workflows/safe-actions.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { requiresConfirmation as ownerRequiresConfirmation } from '@/lib/people/owner-workflows';
import { requiresVendorConfirmation } from '@/lib/vendors/workflows';

describe('safe workflow rules', () => {
  it('requires confirmation for owner outbound and payment actions', () => {
    expect(ownerRequiresConfirmation('send_portal_activation')).toBe(true);
    expect(ownerRequiresConfirmation('preview_owner_packet')).toBe(false);
  });

  it('requires confirmation for vendor outbound and bank actions', () => {
    expect(requiresVendorConfirmation('send_w9_request')).toBe(true);
    expect(requiresVendorConfirmation('preview_vendor_form')).toBe(false);
  });
});
```

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/workflows/safe-actions.test.ts`

Expected: FAIL because workflow helpers do not exist.

- [x] **Step 3: Implement owner workflow helper**

Create `lib/people/owner-workflows.ts`:

```ts
export type OwnerWorkflowAction =
  | 'send_portal_activation'
  | 'transmit_ach'
  | 'authorize_autopay'
  | 'send_owner_packet'
  | 'send_management_agreement'
  | 'preview_owner_packet'
  | 'preview_owner_form';

const confirmationActions: OwnerWorkflowAction[] = [
  'send_portal_activation',
  'transmit_ach',
  'authorize_autopay',
  'send_owner_packet',
  'send_management_agreement',
];

export function requiresConfirmation(action: OwnerWorkflowAction) {
  return confirmationActions.includes(action);
}
```

- [x] **Step 4: Implement vendor workflow helper**

Create `lib/vendors/workflows.ts`:

```ts
export type VendorWorkflowAction =
  | 'send_w9_request'
  | 'send_document_reminder'
  | 'transmit_vendor_ach'
  | 'send_vendor_form'
  | 'preview_vendor_form';

const confirmationActions: VendorWorkflowAction[] = [
  'send_w9_request',
  'send_document_reminder',
  'transmit_vendor_ach',
  'send_vendor_form',
];

export function requiresVendorConfirmation(action: VendorWorkflowAction) {
  return confirmationActions.includes(action);
}
```

- [x] **Step 5: Add owner workflow pages**

Create the owner workflow pages using `DataWorkspace`, `FilterBar`, and `ContextPanel`:

- `app/(app)/owners/ach/page.tsx`: list owners with masked ACH/payment method fields from `payment_methods` and `autopay_mandates`.
- `app/(app)/owners/activations/page.tsx`: list owners with `portal_activated`, `portal_login_last_at`, and invitation state from `user_invitations` when present.
- `app/(app)/owners/packets/page.tsx`: draft workspace for date range, recipients, reports, documents, subject, and body.
- `app/(app)/owners/forms/page.tsx`: draft workspace for owner, association/property, template, recipient, and preview.
- `app/(app)/owners/management-agreements/new/page.tsx`: stepper for owner/property, signature/template, and addendum preview.

- [x] **Step 6: Add vendor workflow pages**

Create the vendor workflow pages:

- `app/(app)/vendors/ach/page.tsx`: vendor ACH setup queue with masked bank data from `vendors`.
- `app/(app)/vendors/w9/page.tsx`: W-9 request filters for tax year, payment threshold, needs 1099, TIN populated, and request status.
- `app/(app)/vendors/compliance/page.tsx`: document reminder filters for document type, last paid, expiration, trade, and compliance state.
- `app/(app)/vendors/forms/page.tsx`: draft vendor form workspace.

- [x] **Step 7: Update directories**

Modify `app/(app)/owners/page.tsx` and `app/(app)/vendors/page.tsx` to add task links to the new workflow pages, scoped reports, and filters.

- [x] **Step 8: Verify tests**

Run: `npm test -- tests/workflows/safe-actions.test.ts`

Expected: PASS.

- [x] **Step 9: Verify build**

Run: `npm run build`

Expected: PASS.

- [x] **Step 10: Commit**

Run:

```bash
git add lib/people lib/vendors app/(app)/owners app/(app)/vendors tests/workflows/safe-actions.test.ts
git commit -m "feat: add owner and vendor workflow foundations"
```

## Task 9: Final Verification And Browser QA

**Files:**
- Modify only files needed to fix issues found by verification.

- [x] **Step 1: Run full test suite**

Run: `npm test`

Expected: all tests pass.

- [x] **Step 2: Run production build**

Run: `npm run build`

Expected: build completes without TypeScript or Next.js route errors.

- [x] **Step 3: Start dev server**

Run: `npm run dev`

Expected: local server starts and prints a localhost URL.

- [x] **Step 4: Browser check desktop**

Open the app in the in-app browser. Verify these routes render without overlapping text at desktop width:

- `/dashboard`
- `/reports`
- `/reports/bank_reconciliation`
- `/violations`
- `/bank-accounts`
- `/bank-accounts/activity`
- `/bank-accounts/reconcile`
- `/owners/ach`
- `/vendors/w9`

- [x] **Step 5: Browser check narrow width**

Resize or use browser tooling for a narrow viewport. Verify navigation collapses or remains usable and dense tables do not overlap core controls.

- [x] **Step 6: Commit verification fixes**

If verification required fixes, run:

```bash
git add .
git commit -m "fix: polish operations redesign verification"
```

If verification required no code changes, do not create an empty commit.

