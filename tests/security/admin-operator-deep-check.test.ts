import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8').replace(/\r\n/g, '\n');
const migration = read('supabase/migrations/20261016130000_admin_operator_fixes.sql');
const fn = (name: string) => {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf('$function$;', start));
};

describe('20261016130000_admin_operator_fixes: company settings and roles', () => {
  it('lets the company admin, not managers, write the company row directly', () => {
    expect(migration).toContain(
      'alter policy portfolios_admin_update on public.portfolios\n'
      + '  using (coalesce(id = (select public.my_admin_portfolio()), false))\n'
      + '  with check (coalesce(id = (select public.my_admin_portfolio()), false));',
    );
    expect(migration).not.toMatch(/portfolios_admin_update[\s\S]{0,200}is_full_access_staff/);
  });

  it('keeps plan, status, address and the fee-run markers out of direct writes', () => {
    const guard = fn('portfolios_guard_platform_columns');
    expect(guard).toContain("if current_user in ('authenticated', 'anon')");
    expect(guard).toContain('new.management_fee_auto_last_month is distinct from old.management_fee_auto_last_month');
    for (const column of ['tier', 'entitlements', 'archived_at', 'suspended_at', 'suspension_reason', 'slug', 'custom_domain', 'created_by']) {
      expect(guard, column).toContain(`new.${column} is distinct from old.${column}`);
    }
    // White label: company staff can see this message.
    expect(guard).not.toContain('Portier369');
  });

  it('makes staff roles the company admin\'s', () => {
    expect(migration).toMatch(/alter policy user_roles_admin_all on public\.user_roles\s+using \(\(select public\.is_platform_operator\(\)\)\s+or coalesce\(portfolio_id = \(select public\.my_admin_portfolio\(\)\), false\)\)/);
    expect(migration).not.toMatch(/user_roles_admin_all[\s\S]{0,300}is_full_access_staff/);
  });

  it('calls policy helpers once per query', () => {
    expect(migration).not.toMatch(/can_access_portfolio\(|can_admin_portfolio\(/);
  });
});

describe('20261016130000_admin_operator_fixes: a suspended company stops', () => {
  const suspended = (body: string) => /suspended_at is (not )?null/.test(body);

  it('holds its email, but not the platform\'s own mail to it', () => {
    const claim = fn('claim_email_queue_snapshot');
    expect(claim).toContain('where pf.id = email_queue.portfolio_id');
    // Platform mail = sent as Portier369 AND queued by the server or an active
    // operator; the sender name alone doesn't exempt it.
    expect(claim).toContain("like 'portier369%'");
    expect(claim).toMatch(/email_queue\.sent_by is null\s+or exists \(select 1 from public\.platform_operators po\s+where po\.auth_user_id = email_queue\.sent_by and po\.active\)/);
    // ...and not when the company's own names (server mail uses them, sent_by null) start with it.
    expect(claim).toContain("lower(btrim(coalesce(pf.company_name, ''))) not like 'portier369%'");
    expect(claim).toContain("lower(btrim(coalesce(pf.email_settings->>'from_name', ''))) not like 'portier369%'");
    expect(claim).toContain("lower(btrim(coalesce(a.name, ''))) like 'portier369%'");
    expect(claim).toContain('for update skip locked');
  });

  it('holds automation flows without writing a run row', () => {
    const claim = fn('claim_automation_flow_run');
    expect(claim).toContain('pf.suspended_at is not null');
    expect(claim.indexOf('pf.suspended_at is not null')).toBeLessThan(claim.indexOf('insert into public.automation_flow_runs'));
  });

  it('signed-in users cannot set the fee schedule or domain verification directly', () => {
    const guard = fn('portfolios_guard_platform_columns');
    for (const column of ['management_fee_auto_enabled', 'management_fee_auto_day', 'management_fee_vendor_id',
      'management_fee_gl_account_id', 'custom_domain_verified_at']) {
      expect(guard).toContain(`new.${column} is distinct from old.${column}`);
    }
  });

  it('holds texts, letters, webhooks and AutoPay charges', () => {
    expect(fn('claim_sms_messages')).toMatch(/join public\.portfolios pf\s+on pf\.id = conversation\.portfolio_id\s+and pf\.suspended_at is null/);
    expect(fn('claim_physical_mail')).toContain('where pf.id = physical_mail_deliveries.portfolio_id and pf.suspended_at is not null');
    expect(fn('claim_webhook_deliveries')).toContain('where pf.id = endpoint.portfolio_id and pf.suspended_at is not null');
    const autopay = fn('claim_stripe_autopay_run');
    // Checked before the run row is created, so nothing is claimed or advanced.
    expect(autopay.indexOf('pf.suspended_at is not null')).toBeGreaterThan(-1);
    expect(autopay.indexOf('pf.suspended_at is not null')).toBeLessThan(autopay.indexOf('insert into public.stripe_autopay_runs'));
  });

  it('skips scheduled reports, management fees and automatic late fees', () => {
    for (const name of ['enqueue_scheduled_reports', 'run_scheduled_management_fees', 'cron_assess_late_fees']) {
      expect(suspended(fn(name)), name).toBe(true);
    }
  });

  it('keeps the service-role gate on every delivery claim', () => {
    for (const name of ['claim_email_queue_snapshot', 'claim_sms_messages', 'claim_physical_mail', 'claim_webhook_deliveries']) {
      expect(fn(name), name).toMatch(/service_role/);
    }
  });
});

describe('20261016130000_admin_operator_fixes: reserved company addresses', () => {
  it('reserves mail autodiscovery and sign-in host names', () => {
    const reserved = fn('reserved_portfolio_slug');
    for (const slug of ['autodiscover', 'autoconfig', 'webmail', 'login', 'auth', 'sso', 'billing', 'platform']) {
      expect(reserved, slug).toContain(`'${slug}'`);
    }
    for (const slug of ['www', 'app', 'api', 'admin', 'portier369']) expect(reserved, slug).toContain(`'${slug}'`);
  });
});

describe('admin and operator app fixes', () => {
  it('vendor assistant sends only that company\'s records and hides provider errors', () => {
    const route = read('app/api/ai/vendor-assistant/route.ts');
    expect(route).toContain('buildVendorSnapshot(resolved.portfolioId)');
    expect(route).not.toContain('error?.message ||');
    const snapshot = read('lib/ai/vendor-snapshot.ts');
    expect(snapshot).toContain(".eq('portfolio_id', portfolioId)");
    expect(snapshot).toContain(".in('vendor_id', vendorIds)");
    expect(snapshot).not.toContain(".in('vendor_id', me.vendor_ids)");
  });

  it('operator company changes fail loudly when their audit record is not written', () => {
    const actions = read('app/platform-operator/companies/actions.ts');
    const audit = actions.slice(actions.indexOf('async function writeAudit('), actions.indexOf('function inviteEmailBody'));
    expect(audit).toContain("const { error } = await svc.from('audit_logs').insert(");
    expect(audit).toContain('if (error) fail(');
    // createCompanyWithAdmin finishes the submission before reporting; archive
    // reports ban failures and the audit failure together.
    const create = actions.slice(actions.indexOf('export async function createCompanyWithAdmin'), actions.indexOf('export async function inviteAdmin'));
    expect(create.indexOf('completeSubmission(')).toBeLessThan(create.indexOf('if (auditErrors.length) fail('));
    const archive = actions.slice(actions.indexOf('export async function archiveCompany'), actions.indexOf('export async function changePlan'));
    expect(archive).toContain('if (banFailures.length) problems.push(');
    expect(archive).toContain('if (auditError) problems.push(');
  });

  it('company admin text does not name the platform', () => {
    expect(read('app/company-admin/managers/actions.ts')).not.toContain('Portier369');
  });
});
