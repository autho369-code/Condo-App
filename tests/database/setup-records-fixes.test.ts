import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const charges = read('supabase/migrations/20261016164000_setup_records_fixes.sql').toLowerCase();
const scope = read('supabase/migrations/20261016164100_setup_records_scope_fixes.sql').toLowerCase();

function fnBody(sql: string, name: string, from = 0): string {
  const start = sql.indexOf(`function public.${name}(`, from);
  expect(start, `${name} is defined`).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf('$function$;', start));
}

describe('setup records: recurring and bulk charges migration', () => {
  it('keeps every DELETE and DROP out', () => {
    for (const sql of [charges, scope]) {
      expect(sql).not.toMatch(/\bdelete\s+from\b/);
      expect(sql).not.toMatch(/\bdrop\s+(table|policy|function|trigger|column)\b/);
    }
  });

  it('serializes bulk recurring runs per unit and starts after periods already posted', () => {
    const body = fnBody(charges, 'bulk_create_recurring_charges');
    expect(body).toContain('from public.units u where u.id = sub.unit_id for update');
    expect(body).toContain('r.last_posted_at is not null');
    expect(body).toContain('greatest(v_start, coalesce(v_next, v_start))');
    expect(body).toContain('public.association_local_date(v_assoc)');
    expect(body).not.toContain('current_date');
  });

  it('accepts only the unit association\'s own or company-wide categories in both bulk RPCs', () => {
    for (const name of ['bulk_create_recurring_charges', 'bulk_create_charges']) {
      expect(fnBody(charges, name)).toContain('(c.association_id is null or c.association_id = v_assoc)');
    }
    expect(fnBody(charges, 'bulk_create_charges')).toContain('public.association_local_date(v_assoc) + 30');
  });

  it('guards category scope in the database for every writer', () => {
    expect(charges).toMatch(/on public\.unit_recurring_charges\s+for each row execute function public\.enforce_charge_category_unit_scope\('association'\)/);
    expect(charges).toMatch(/on public\.charges\s+for each row execute function public\.enforce_charge_category_unit_scope\('company'\)/);
    expect(charges).toContain('before insert or update of unit_id, charge_category_id on public.charges');
    const company = fnBody(charges, 'enforce_charge_category_company');
    expect(company).toContain('a.portfolio_id = new.portfolio_id');
    expect(company).toContain('g.portfolio_id = new.portfolio_id');
    expect(company).toContain('already used by other associations');
  });

  it('posts recurring charges by each association\'s date and skips archived units', () => {
    const body = fnBody(charges, 'post_unit_recurring_charges');
    expect(body).toContain("urc.next_post_date <= (now() at time zone coalesce(nullif(a.timezone, ''), 'america/chicago'))::date");
    expect(body).toContain('(cc.association_id is null or cc.association_id = b.association_id)');
    expect(body).toContain('un.archived_at is null');
    expect(body).not.toContain('current_date');
  });

  it('starts a blank subscription on the association\'s today and closes it to signed-out callers', () => {
    const first = fnBody(charges, 'subscribe_unit_to_charge');
    const second = fnBody(charges, 'subscribe_unit_to_charge', charges.lastIndexOf('create or replace function public.subscribe_unit_to_charge('));
    for (const body of [first, second]) {
      expect(body).toContain('select public.association_local_date(b.association_id) into v_start');
      expect(body).toContain('p_start_date date default null::date');
      // unit_association_id is not executable by signed-in callers (invoker function).
      expect(body).not.toContain('unit_association_id');
    }
    expect(charges).toContain('date, text) from public, anon');
    expect(charges).toContain('date, text, text) from public, anon');
  });
});

describe('setup records: scope and privacy migration', () => {
  it('checks Stripe fields as the caller (invoker) and linked records with full visibility (definer)', () => {
    const guard = fnBody(scope, 'associations_payment_settings_guard');
    expect(guard).toContain('security invoker');
    expect(guard).toContain("current_user not in ('authenticated', 'anon')");
    expect(guard).toContain('new.stripe_account_id is distinct from old.stripe_account_id');
    expect(guard).toContain('public.is_finance_staff()');
    const linked = fnBody(scope, 'associations_linked_records_guard');
    expect(linked).toContain('security definer');
    expect(linked).toContain('b.portfolio_id is distinct from new.portfolio_id');
    expect(linked).toContain('m.portfolio_id = new.portfolio_id');
  });

  it('removes hard deletes of units, buildings and associations from signed-in users', () => {
    expect(scope).toContain('revoke delete on public.units, public.buildings, public.associations from authenticated, anon');
  });

  it('takes the company of owner ACH/tax and packet settings from the owner', () => {
    expect(fnBody(scope, 'owner_settings_company_from_owner')).toContain('new.portfolio_id := v_portfolio');
    expect(scope).toContain('on public.owner_financial_details');
    expect(scope).toContain('on public.owner_packet_settings');
  });

  it('keeps lock boxes, calendar reminders and board seats inside their association', () => {
    expect(fnBody(scope, 'lock_boxes_scope_guard')).toContain('a.portfolio_id = new.portfolio_id');
    expect(fnBody(scope, 'calendar_event_reminders_scope_guard')).toContain('new.association_id is distinct from v_event.association_id');
    expect(fnBody(scope, 'board_members_owner_association_guard')).toContain('o.association_id = new.association_id');
  });

  it('serves residents parking without staff notes and switches their direct reads off', () => {
    const rpc = fnBody(scope, 'portal_parking_assignments');
    expect(rpc).not.toMatch(/pa\.notes|ps\.notes|created_by/);
    expect(rpc).toContain("pa.status = 'active' and pa.unit_id in (select public.current_resident_unit_ids())");
    expect(scope).toContain('alter policy parking_assignments_resident_read on public.parking_assignments using (false)');
    expect(scope).toContain('alter policy parking_spaces_resident_read on public.parking_spaces using (false)');
    expect(scope).toContain('revoke all on function public.portal_parking_assignments() from public, anon');
  });
});

describe('setup records: app fixes', () => {
  it('claims a one-time token and checks the chosen association in bulk charge actions', () => {
    const src = read('lib/rpcs/bulk-operations.ts');
    expect(src).toContain("claimSubmission(db, formData, 'bulk_charges')");
    expect(src).toContain("claimSubmission(db, formData, 'bulk_recurring_charges')");
    expect(src.match(/bulkUnitsError\(db, str\(formData, 'association_id'\), unitIds\)/g)?.length).toBe(2);
    expect(src).toContain("Array.isArray(data) ? data[0] : data");
    for (const form of ['app/(app)/charges/bulk/_bulk-charges-form.tsx', 'app/(app)/charges/bulk-recurring/_bulk-recurring-form.tsx']) {
      const f = read(form);
      expect(f).toContain("fd.set('submission_token', submissionToken)");
      expect(f).toContain("fd.set('association_id', selectedAssoc)");
      expect(f).toContain('c.association_id === selectedAssoc');
    }
  });

  it('never trusts a bound company id for owner financial details or a form company id for categories', () => {
    expect(read('app/(app)/owners/[id]/financial-actions.ts')).toContain('portfolio_id: owner.portfolio_id');
    const chargesSrc = read('lib/rpcs/charges.ts');
    expect(chargesSrc).toContain('portfolio_id:       portfolioId');
    expect(chargesSrc).not.toContain("formData.get('portfolio_id')");
    expect(chargesSrc).toContain("claimSubmission(db, formData, 'unit_recurring_charge')");
  });

  it('seats only current homeowners of the association on its board', () => {
    const src = read('lib/rpcs/board-membership.ts');
    expect(src).toContain('owner.association_id !== associationId');
    expect(src).toContain('move_out_date.gt.${local.today}');
    expect(src).not.toContain('todayInZone');
  });

  it('releases a parking space once and bills the unit association\'s own parking category', () => {
    const src = read('app/(app)/parking/actions.ts');
    expect(src).toContain(".eq('id', assignmentId).eq('status', 'active')");
    expect(src).toContain('association_id.is.null,association_id.eq.${unitAssociationId}');
  });

  it('never emails former owners or a buyer about the seller\'s work orders from automation flows', () => {
    const src = read('app/api/automation/run-flows/route.ts');
    expect(src).toContain('isCurrentOwnerIn(svc, ownerId, subject.associationId, today)');
    expect(src).toContain('workOrderPredatesOwner(subject.createdAt, since, tz)');
    expect(src).toContain('addDaysToDate(today, -days)');
    expect(src).not.toContain('isoDateDaysAgo');
  });

  it('reads resident parking through the safe RPC', () => {
    expect(read('app/portal/vehicles/page.tsx')).toContain("db.rpc('portal_parking_assignments')");
    expect(read('app/portal/home/page.tsx')).toContain("db.rpc('portal_parking_assignments')");
  });

  it('sends calendar reminders only for their own event and only to current owners', () => {
    const src = read('lib/calendar/reminder-delivery.ts');
    expect(src).toContain('r.portfolio_id !== event.portfolio_id');
    expect(src).toContain('move_out_date.is.null,move_out_date.gt.${today}');
    expect(read('lib/rpcs/calendar.ts')).toContain(".is('owners.archived_at', null)");
  });
});
