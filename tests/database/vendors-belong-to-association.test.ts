import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A vendor record belongs to exactly one association (the management company
// is the one company-level vendor). Migration
// 20261009020000_vendors_belong_to_association.sql enforces it in the
// database; these checks keep the app's writers and pickers in step.

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(resolve(root, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const rel = join(dir, name);
    const st = statSync(resolve(root, rel));
    if (st.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

/** The text of a call's argument list starting at `open` (an index of "("). */
function callArgs(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return src.slice(open + 1);
}

/** Every `.from('vendors')…insert(…)` / `upsert('vendors', …)` payload in a file. */
function vendorWrites(src: string): string[] {
  const payloads: string[] = [];
  const fromRe = /\.from\(\s*['"`]vendors['"`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = fromRe.exec(src))) {
    const rest = src.slice(m.index + m[0].length);
    const chain = rest.match(/^\s*\.(insert|upsert)\(/);
    if (!chain) continue;
    payloads.push(callArgs(src, m.index + m[0].length + chain[0].length - 1));
  }
  const upsertRe = /upsert\(\s*['"`]vendors['"`]\s*,/g;
  while ((m = upsertRe.exec(src))) payloads.push(callArgs(src, m.index + 'upsert'.length));
  return payloads;
}

describe('vendors belong to exactly one association', () => {
  const migration = read('supabase/migrations/20261009020000_vendors_belong_to_association.sql');

  it('adds the association and management-company columns and backfills before requiring one of them', () => {
    expect(migration).toContain('add column if not exists association_id uuid references public.associations(id) on delete restrict');
    expect(migration).toContain('add column if not exists is_management_company boolean not null default false');
    expect(migration).toContain('create index if not exists idx_vendors_association_id on public.vendors(association_id)');
    const backfill = migration.indexOf('update public.vendors set association_id');
    const guard = migration.indexOf('These vendors cannot be placed in one association');
    const check = migration.indexOf('vendors_association_or_management_company');
    expect(backfill).toBeGreaterThan(0);
    expect(guard).toBeGreaterThan(backfill);
    expect(check).toBeGreaterThan(guard);
    expect(migration).toContain('(is_management_company and association_id is null) or (not is_management_company and association_id is not null)');
  });

  it('guards every table that links a vendor to an association', () => {
    for (const t of ['work_orders', 'payable_bills', 'payable_checks', 'purchase_orders', 'recurring_bills', 'recurring_work_orders',
      'recurring_purchase_orders', 'vendor_credits', 'credit_card_charges', 'other_receipts', 'maintenance_tasks',
      'calendar_events', 'approval_requests', 'inspections']) {
      expect(migration).toContain(`'public.${t}'::regclass`);
    }
    expect(migration).toContain("'public.inspections'::regclass, 'inspector_vendor_id'::name");
    expect(migration).toContain("'This vendor belongs to another association. Add it as a vendor of this association.'");
    expect(migration).toMatch(/for share;\s+-- A missing vendor is left to the foreign key\./);
  });

  it('derives portfolio_id from the association, refuses moves with rows, and locks down its functions', () => {
    expect(migration).toMatch(/before insert or update of association_id, portfolio_id, is_management_company on public\.vendors/);
    expect(migration).toContain('new.portfolio_id := v_portfolio_id;');
    expect(migration).toContain('after update of portfolio_id on public.associations');
    for (const fn of ['vendors_set_portfolio_from_association', 'vendor_link_same_association', 'associations_move_vendor_portfolio']) {
      expect(migration).toContain(`revoke all on function public.${fn}() from public, anon, authenticated;`);
      const body = migration.slice(migration.indexOf(`function public.${fn}()`));
      expect(body.slice(0, 300)).toContain('security definer');
      expect(body.slice(0, 300)).toContain("set search_path to 'pg_catalog', 'public'");
    }
  });

  it('lets only company-wide finance staff mark the one management company', () => {
    expect(migration).toMatch(/if auth\.uid\(\) is not null\s+and \(\(tg_op = 'INSERT' and new\.is_management_company\)/);
    expect(migration).toContain('and (not public.manager_is_scoped() or public.is_company_admin())) then');
    expect(migration).toContain('create unique index if not exists vendors_one_management_company');
  });

  it('lets association-scoped managers see but not change the management company', () => {
    expect(migration).toContain('return p_association_id is not null or not public.manager_is_scoped() or public.is_company_admin();');
    expect(migration).toContain("array['vendors', 'vendor_private', 'vendor_compliance', 'vendor_financial_details']");
    for (const p of ['mgr_company_vendor_insert', 'mgr_company_vendor_update', 'mgr_company_vendor_delete']) {
      expect(migration).toContain(`create policy ${p} on public.%I as restrictive`);
    }
  });

  it('keeps vendors linked through a parent in the parent\'s association', () => {
    for (const [t, parentCol, parent] of [['work_order_estimates', 'work_order_id', 'work_orders'], ['work_order_ratings', 'work_order_id', 'work_orders'],
      ['maintenance_task_history', 'task_id', 'maintenance_tasks'], ['lock_box_assignments', 'lock_box_id', 'lock_boxes']]) {
      expect(migration).toContain(`('public.${t}'::regclass, 'vendor_id'::name, '${parentCol}'::name, 'public.${parent}'::regclass)`);
    }
    // Counted when placing a vendor and when guarding its moves.
    expect(migration).toContain('for r in select * from public.vendor_parent_link_tables() loop');
    // Child writes lock and check the parent; parents cannot move away from their children's vendors.
    expect(migration).toContain("execute format('select association_id from %s where id = $1 for share', tg_argv[2]::regclass)");
    // Rows that existed before the migration are checked too.
    expect(migration).toContain('has rows whose vendor belongs to another association. Correct them, then run this migration again.');
    expect(migration).toContain('create or replace trigger trg_vendor_parent_same_association before insert or update of %I, %I on %s');
    expect(migration).toContain('create or replace trigger trg_vendor_parent_association_moved before update of association_id on %s');
    for (const fn of ['vendor_link_parent_same_association', 'vendor_parent_association_moved']) {
      expect(migration).toContain(`revoke all on function public.${fn}() from public, anon, authenticated;`);
    }
    const estimate = read('lib/rpcs/work-orders.ts');
    expect(estimate).toContain('!vendor.is_management_company && vendor.association_id !== workOrder.association_id');
  });

  it('limits association-scoped managers to their associations\' vendors', () => {
    expect(migration).toMatch(/create policy mgr_assoc_scope on public\.vendors as restrictive for all to authenticated\s+using \(public\.can_view_association_row\(association_id\)\)/);
    for (const t of ['vendor_private', 'vendor_compliance', 'vendor_financial_details']) {
      expect(migration).toMatch(new RegExp(`create policy mgr_assoc_scope on public\\.${t} as restrictive`));
    }
  });

  it('bills management fees only to the management company', () => {
    expect(migration).toContain('create or replace function public.set_management_fee_schedule(');
    expect(migration).toMatch(/v\.is_management_company\) then/);
    expect(read('app/(app)/accounting/management-fees/page.tsx')).toContain(".eq('is_management_company', true)");
  });

  it('links one vendor record per sign-in without dropping anything', () => {
    expect(migration).not.toMatch(/^\s*drop\s/im);
    expect(migration).not.toMatch(/drop (index|constraint|policy|trigger)/i);
    expect(migration).toMatch(/from public\.vendors candidate[\s\S]+order by candidate\.created_at, candidate\.id\s+limit 1/);
    expect(migration).toMatch(/join public\.vendors v on v\.portfolio_id = p\.portfolio_id[\s\S]+order by u\.id, v\.created_at, v\.id/);
  });

  it('records the new columns and foreign key in the schema snapshots', () => {
    const columns = JSON.parse(read('supabase/schema-columns.json'));
    expect(columns.vendors).toEqual(expect.arrayContaining(['association_id', 'is_management_company']));
    expect([...columns.vendors].sort()).toEqual(columns.vendors);
    const fks = JSON.parse(read('supabase/schema-foreign-keys.json'));
    expect(fks['vendors.association_id']).toBe('associations');
  });

  it('sets association_id on every vendors insert or upsert', () => {
    const files = ['app', 'lib', 'components', 'scripts'].flatMap(sourceFiles);
    const writers: string[] = [];
    for (const file of files) {
      const src = read(file);
      for (const payload of vendorWrites(src)) {
        writers.push(file);
        const scope = /association_id/.test(payload) ? payload : src;
        expect(scope, `${file}: vendors insert without association_id`).toMatch(/association_id\s*:/);
      }
    }
    expect(new Set(writers)).toEqual(new Set([
      'app/(app)/owners/import/previous-system/vendor-actions.ts',
      'lib/rpcs/entities.ts',
      'scripts/seed-real.ts',
      'scripts/seed-comprehensive.ts',
      'scripts/seed-staging-verification.mjs',
    ]));
  });

  it('imports vendors into one chosen association and matches work-order vendors inside it', () => {
    const vendorImport = read('app/(app)/owners/import/previous-system/vendor-actions.ts');
    expect(vendorImport).toContain('export async function importAppfolioVendors(associationId: string, vendors: AppfolioVendor[])');
    expect(vendorImport).toContain("db.rpc('can_manage_association', { p_association_id: associationId })");
    expect(vendorImport).toContain(".eq('association_id', associationId)");
    expect(read('app/(app)/owners/import/previous-system/work-order-actions.ts')).toContain(".eq('association_id', associationId).is('archived_at', null)");
  });

  it('checks the association on vendor create', () => {
    const entities = read('lib/rpcs/entities.ts');
    const create = entities.slice(entities.indexOf('export async function createVendor'));
    expect(create).toContain("rpc('can_manage_association', { p_association_id: associationId })");
    expect(create).toContain('association_id: associationId,');
    expect(create).toContain('is_management_company: isManagementCompany,');
  });
});
