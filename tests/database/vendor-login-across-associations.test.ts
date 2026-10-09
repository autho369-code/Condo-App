import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// One vendor login reaches every vendor record whose invitation it accepted
// (one record per association). Migration 20261009040000.

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const migration = read('supabase/migrations/20261009040000_vendor_login_across_associations.sql');

describe('vendor login across associations: database', () => {
  it('keeps the added records in their own table with RLS and no user writes', () => {
    expect(migration).toContain('create table if not exists public.vendor_portal_logins');
    expect(migration).toContain('alter table public.vendor_portal_logins enable row level security;');
    expect(migration).toContain('revoke all on public.vendor_portal_logins from public, anon, authenticated;');
    expect(migration).toContain('grant select on public.vendor_portal_logins to authenticated;');
    expect(migration).not.toMatch(/create policy [a-z_]+ on public\.vendor_portal_logins for (insert|update|delete|all)/);
  });

  it('resolves the login to its linked record plus accepted ones, never by email', () => {
    const helper = migration.slice(migration.indexOf('create or replace function public.current_vendor_ids()'));
    const body = helper.slice(0, helper.indexOf('$function$;'));
    expect(body).toContain('v.auth_user_id = auth.uid()');
    expect(body).toContain('from public.vendor_portal_logins l');
    expect(body).toContain('and v.portal_activated');
    expect(body).toContain('and v.archived_at is null');
    expect(body).not.toMatch(/emails/);
    expect(migration).toContain('return (select x from public.current_vendor_ids() x limit 1);');
  });

  it('rewrites every single-record policy and refuses to finish if one is left', () => {
    expect(migration).toContain("v_pattern constant text := '= (public\\.)?current_vendor_id\\(\\)';");
    expect(migration).toContain("regexp_replace(r.qual, v_pattern, 'IN ( SELECT public.current_vendor_ids())', 'g')");
    expect(migration).toContain("regexp_replace(r.with_check, v_pattern, 'IN ( SELECT public.current_vendor_ids())', 'g')");
    expect(migration).toContain("raise exception 'A policy still compares with current_vendor_id(). Check it, then run this migration again.';");
    expect(migration).not.toMatch(/drop policy/i);
  });

  it('bills an invoice to the work order\'s own vendor record', () => {
    expect(migration).toContain("select wo.vendor_id, wo.portfolio_id, wo.association_id, wo.status::text");
    expect(migration).toContain('and wo.vendor_id in (select public.current_vendor_ids())');
    expect(migration).toContain("if p_attachment_path not like 'vendors/' || v_vendor_id::text || '/invoice/%'");
  });

  it('adds an invited record to an existing login only for that exact record', () => {
    expect(migration).toContain("insert into public.vendor_portal_logins (vendor_id, auth_user_id, portfolio_id, invitation_id)");
    expect(migration).toContain("where c.id::text = new.metadata ->> 'vendor_id'");
    expect(migration).toContain('and c.auth_user_id is null');
    expect(migration).toContain('on conflict (vendor_id) do nothing;');
  });

  it('never gives a record that is already on one login to another login', () => {
    expect(migration.match(/not exists \(select 1 from public\.vendor_portal_logins l where l\.vendor_id = (c|candidate|v)\.id\)/g)).toHaveLength(3);
    expect(migration).toContain('create or replace function public.auto_link_portal_user()');
    expect(migration).toContain('create or replace function public.relink_all_portal_users()');
  });

  it('lets staff of the record\'s own company read its added logins', () => {
    expect(migration).toContain('and public.can_access_portfolio(ven.portfolio_id)');
  });

  it('returns every record from me()', () => {
    expect(migration).toContain("'vendor_ids', array(select public.current_vendor_ids()),");
  });
});

describe('vendor login across associations: app', () => {
  it('lists work, bills and schedule across every record of the login', () => {
    for (const file of [
      'app/vendor/page.tsx',
      'app/vendor/work-orders/page.tsx',
      'app/vendor/work-orders/[id]/page.tsx',
      'app/vendor/schedule/page.tsx',
      'app/vendor/payments/page.tsx',
      'app/vendor/properties/page.tsx',
      'lib/ai/vendor-snapshot.ts',
      'lib/rpcs/work-orders-messages.ts',
    ]) {
      expect(read(file), file).not.toContain(".eq('vendor_id', me.vendor_id)");
      expect(read(file), file).not.toContain(".eq('vendor_id', me2.vendor_id)");
    }
  });

  it('writes uploads to one exact record of the login', () => {
    const actions = read('lib/rpcs/vendor-submissions.ts');
    expect(actions).toContain('return ids.includes(vendorId) ? vendorId : null;');
    expect(actions).toContain("const vendorRecord = await workOrderVendorRecord(me, input.workOrderId);");
    expect(actions).toContain('const path = `vendors/${vendorRecord}/${category}/${randomUUID()}-${normalizedName}`;');
    expect(read('app/vendor/compliance/page.tsx')).toContain("const record = me2.vendor_ids.includes(target) ? target : null;");
  });

  it('keeps invites for the vendor\'s other associations when re-inviting one record', () => {
    expect(read('app/(app)/vendors/actions.ts')).toContain('.or(`metadata->>vendor_id.eq.${vendor.id},metadata->>vendor_id.is.null`)');
  });

  it('lets staff turn off one record\'s portal access', () => {
    const actions = read('app/(app)/vendors/actions.ts');
    expect(actions).toContain('export async function turnOffVendorPortal(formData: FormData)');
    expect(actions).toContain(".update({ portal_activated: false })");
    expect(read('app/(app)/vendors/[id]/page.tsx')).toContain('<form action={turnOffVendorPortal}');
  });
});
