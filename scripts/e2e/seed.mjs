// Seed the local browser-test database (e2e/supabase, port 55321) with one test
// management company: an association with a unit, an owner, a vendor, a
// company admin, a small chart of accounts and the app's own defaults.
//
//   node scripts/e2e/seed.mjs
//
// Reads the local URL and keys from `supabase status` and refuses any URL that
// isn't the local test database. Safe to re-run: it deletes the previous test
// company first (local database only).
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { E2E } from '../../e2e/fixture.mjs';

const status = execFileSync('npx', ['supabase', 'status', '--workdir', 'e2e', '-o', 'env'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32',
});
const env = Object.fromEntries(status.split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const url = env.API_URL;
const anonKey = env.ANON_KEY || env.PUBLISHABLE_KEY;
const serviceKey = env.SERVICE_ROLE_KEY || env.SECRET_KEY;
if (!/^http:\/\/127\.0\.0\.1:55321\/?$/.test(url ?? '')) throw new Error(`Refusing: ${url} is not the local test database (http://127.0.0.1:55321).`);

// Fresh test password and cron secret for this run (local database only).
const password = `E2e-${randomBytes(12).toString('base64url')}-9`;
const cronSecret = randomBytes(32).toString('hex');

// Local-only settings for the dev server the tests drive (git-ignored).
writeFileSync('.env.e2e.local', [
  '# Local browser tests: the Next.js dev server talks to the local test database only.',
  `NEXT_PUBLIC_SUPABASE_URL=${url}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${anonKey}`,
  `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`,
  `SUPABASE_SECRET_KEY=${serviceKey}`,
  'NEXT_PUBLIC_SITE_URL=http://localhost:3100',
  'NEXT_PUBLIC_PORTAL_URL=http://localhost:3100',
  'NEXT_PUBLIC_APEX_DOMAIN=localhost',
  `CRON_SECRET=${cronSecret}`,
  `RATE_LIMIT_SECRET=${cronSecret}`,
  `E2E_TEST_PASSWORD=${password}`,
  '',
].join('\n'));

const svc = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
async function must(label, p) {
  const r = await p;
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  return r.data;
}
const id = E2E.ids;

// 0. Start from nothing (local database only).
const sql = (q) => execFileSync('docker', ['exec', '-i', 'supabase_db_portier369-e2e', 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], {
  input: q, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
});
sql(`
  set session_replication_role = replica;  -- skip guard triggers while clearing local test rows
  delete from public.payment_applications where payment_id in (select id from public.payments where unit_id in (select id from public.units where building_id = '${id.building}'));
  delete from public.journal_lines where entry_id in (select id from public.journal_entries where portfolio_id = '${id.portfolio}');
  delete from public.journal_entries where portfolio_id = '${id.portfolio}';
  do $$ declare t text; begin
    for t in select c.table_name from information_schema.columns c join information_schema.tables tb on tb.table_name = c.table_name and tb.table_schema = c.table_schema
             where c.table_schema = 'public' and c.column_name = 'association_id' and tb.table_type = 'BASE TABLE' and c.table_name <> 'associations'
    loop execute format('delete from public.%I where association_id = %L', t, '${id.association}'); end loop;
    for t in select c.table_name from information_schema.columns c join information_schema.tables tb on tb.table_name = c.table_name and tb.table_schema = c.table_schema
             where c.table_schema = 'public' and c.column_name = 'unit_id' and tb.table_type = 'BASE TABLE'
    loop execute format('delete from public.%I where unit_id in (select id from public.units where building_id = %L)', t, '${id.building}'); end loop;
    for t in select c.table_name from information_schema.columns c join information_schema.tables tb on tb.table_name = c.table_name and tb.table_schema = c.table_schema
             where c.table_schema = 'public' and c.column_name = 'portfolio_id' and tb.table_type = 'BASE TABLE' and c.table_name not in ('portfolios', 'profiles')
    loop execute format('delete from public.%I where portfolio_id in (%L, %L)', t, '${id.portfolio}', '${id.otherPortfolio}'); end loop;
  end $$;
  -- Anything else the test accounts created (e.g. a vendor's uploaded invoice document).
  do $$ declare r record; begin
    for r in select c.relname as tbl, att.attname as col
               from pg_constraint con
               join pg_class c on c.oid = con.conrelid
               join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
               join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
              where con.contype = 'f' and con.confrelid = 'auth.users'::regclass
    loop execute format('delete from public.%I where %I in (select id from auth.users where email like %L)', r.tbl, r.col, '%@e2e.portier369.test'); end loop;
  end $$;
  delete from public.units where building_id = '${id.building}';
  delete from public.buildings where id = '${id.building}';
  delete from public.associations where id = '${id.association}';
  delete from public.profiles where portfolio_id in ('${id.portfolio}', '${id.otherPortfolio}');
  delete from public.portfolios where id in ('${id.portfolio}', '${id.otherPortfolio}');
  set session_replication_role = origin;
  delete from auth.identities where user_id not in (select id from auth.users);
  delete from auth.users where email like '%@e2e.portier369.test';
  delete from public.api_rate_limits where scope like 'password_login%';
`);

// 1. Company.
await must('portfolio', svc.from('portfolios').insert({ id: id.portfolio, company_name: E2E.companyName, slug: 'e2e-test-management', tier: 'growth' }));

// 2. Users (local test accounts).
async function user(email, fullName, role, portfolioId = id.portfolio) {
  const created = await must(`user ${email}`, svc.auth.admin.createUser({ email, password, email_confirm: true }));
  const isStaff = role === 'company_admin' || role === 'manager';
  await must(`profile ${email}`, svc.from('profiles').upsert({
    id: created.user.id, email, full_name: fullName, display_name: fullName, portfolio_id: portfolioId,
    role, hoa_role: role, mvp_role: isStaff ? role : null,
  }));
  return created.user;
}
const admin = await user(E2E.admin.email, E2E.admin.name, 'company_admin');
// Day-to-day work in the tests is done by a manager (company admins must enrol MFA).
await user(E2E.manager.email, E2E.manager.name, 'manager');

// 3. Chart of accounts (company-wide) and its defaults.
const gl = [
  [id.glCash, '1000', 'Operating Cash', 'cash'],
  [id.glAr, '1200', 'Accounts Receivable', 'accounts_receivable'],
  [id.glAp, '2000', 'Accounts Payable', 'accounts_payable'],
  [id.glAssessments, '4000', 'Assessment Income', 'income'],
  [id.glLateFees, '4100', 'Late Fee Income', 'income'],
  [id.glFines, '4200', 'Violation Fine Income', 'income'],
  [id.glRepairs, '6100', 'Repairs and Maintenance', 'expense'],
];
await must('gl accounts', svc.from('gl_accounts').insert(gl.map(([gid, number, name, account_type]) => ({ id: gid, portfolio_id: id.portfolio, number, name, account_type, active: true }))));
await must('gl map', svc.from('gl_account_map').insert([
  ['accounts_receivable', id.glAr], ['accounts_payable', id.glAp], ['late_fee_income', id.glLateFees], ['default_income', id.glAssessments],
].map(([map_key, gl_account_id]) => ({ portfolio_id: id.portfolio, map_key, gl_account_id }))));

// 4. Association (its Operating and Reserve bank accounts are created by a trigger).
await must('association', svc.from('associations').insert({
  id: id.association, portfolio_id: id.portfolio, name: E2E.associationName, address: '100 Test Avenue', city: 'Chicago', state: 'IL', zip: '60601',
  fiscal_year_start: 1, created_by: admin.id, late_fee_enabled: true, late_fee_amount: 25, late_fee_is_percent: false, late_fee_grace_days: 10,
}));
const banks = await must('banks', svc.from('bank_accounts').select('id, purpose').eq('association_id', id.association));
const operating = banks.find((b) => b.purpose === 'operating');
await must('bank gl', svc.from('bank_accounts').update({ gl_account_id: id.glCash, next_check_number: 1001, check_signature: 'Board Treasurer', bank_name: 'E2E Community Bank' }).eq('id', operating.id));
await must('building', svc.from('buildings').insert({ id: id.building, association_id: id.association, name: 'Main Building', address: '100 Test Avenue' }));
await must('unit', svc.from('units').insert({ id: id.unit, building_id: id.building, unit_number: '101', ownership_pct: 100 }));

// 5. Owner with a portal login, living in unit 101 since last year (unit_owners
//    follows the occupancy by trigger).
await must('owner', svc.from('owners').insert({ id: id.owner, portfolio_id: id.portfolio, association_id: id.association, full_name: E2E.owner.name, email: E2E.owner.email, electronic_consent: true }));
const moveIn = `${new Date().getFullYear() - 1}-01-01`;
await must('occupancy', svc.from('occupancies').insert({ unit_id: id.unit, association_id: id.association, owner_id: id.owner, occupancy_type: 'owner', status: 'current', move_in_date: moveIn, is_primary: true, share_pct: 100 }));
const ownerUser = await user(E2E.owner.email, E2E.owner.name, 'owner');
await must('owner login', svc.from('owners').update({ auth_user_id: ownerUser.id, portal_activated: true }).eq('id', id.owner));

// 6. Vendor.
await must('vendor', svc.from('vendors').insert({ id: id.vendor, portfolio_id: id.portfolio, association_id: id.association, name: E2E.vendorName, default_gl_account_id: id.glRepairs }));
const vendorUser = await user(E2E.vendor.email, E2E.vendor.name, 'vendor');
await must('vendor login', svc.from('vendors').update({ auth_user_id: vendorUser.id, portal_activated: true }).eq('id', id.vendor));

// 7. The app's own defaults, as the company admin would set them up.
const asAdmin = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
await must('admin sign-in', asAdmin.auth.signInWithPassword({ email: E2E.admin.email, password }));
// (The standard charge categories are created with the company, by trigger.)
await must('house rules + violation schedule', asAdmin.rpc('install_starter_house_rules', { p_association_id: id.association }));
const cats = await must('categories', svc.from('charge_categories').select('id, code').eq('portfolio_id', id.portfolio));
const glByCode = { DUES: id.glAssessments, LATEFEE: id.glLateFees, VIOLATION: id.glFines };
for (const c of cats) if (glByCode[c.code]) await must(`category gl ${c.code}`, svc.from('charge_categories').update({ gl_account_id: glByCode[c.code] }).eq('id', c.id));
const fine = cats.find((c) => c.code === 'VIOLATION');
await must('violation settings', svc.from('association_violation_settings').upsert({ association_id: id.association, fine_charge_category_id: fine.id }));

// 8. A second, unrelated company with its own manager (isolation tests).
await must('other portfolio', svc.from('portfolios').insert({ id: id.otherPortfolio, company_name: E2E.otherCompanyName, slug: 'e2e-other-management', tier: 'growth' }));
await user(E2E.otherManager.email, E2E.otherManager.name, 'manager', id.otherPortfolio);

console.log(`seeded ${E2E.companyName}: admin ${E2E.admin.email}, owner ${E2E.owner.email}, unit 101`);
