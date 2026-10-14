import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reminderWindow } from '@/lib/insurance/reminder-window';
import { amenityPriceLabel, amenityReserveAction, withinAmenityHours } from '@/lib/amenities/portal';
import { inspectionSearchOr, inspectionSearchTerm } from '@/lib/inspections/list-query';
import { expirationTone, vendorComplianceStatus } from '@/lib/company-admin/vendor-compliance';
import { selectInChunks } from '@/lib/supabase/select-in-chunks';

const MIGRATION = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261015080000_insurance_inspections_fixes.sql'),
  'utf8',
);
const SQL = MIGRATION.replace(/--[^\n]*/g, '');

describe('insurance reminder windows', () => {
  it('sends the 30-day reminder once, then the 15-day one', () => {
    expect(reminderWindow(30, {})).toBe(30);
    expect(reminderWindow(16, { reminder_30_sent_at: '2026-10-01' })).toBeNull();
    expect(reminderWindow(15, { reminder_30_sent_at: '2026-10-01' })).toBe(15);
    expect(reminderWindow(0, {})).toBe(15);
    expect(reminderWindow(3, { reminder_15_sent_at: '2026-10-01' })).toBeNull();
  });
  it('sends nothing outside the window', () => {
    expect(reminderWindow(31, {})).toBeNull();
    expect(reminderWindow(-1, {})).toBeNull();
    expect(reminderWindow(Number.NaN, {})).toBeNull();
  });
});

describe('resident amenities follow the configured reserve method', () => {
  it('email, link and in-portal request', () => {
    expect(amenityReserveAction({ allow_reservations: true, reserve_method: 'email', reservation_email: 'book@example.com' }))
      .toEqual({ kind: 'email', email: 'book@example.com' });
    expect(amenityReserveAction({ allow_reservations: true, reserve_method: 'platform_link', reservation_url: 'https://book.example.com/pool' }))
      .toEqual({ kind: 'link', url: 'https://book.example.com/pool' });
    expect(amenityReserveAction({ allow_reservations: true, reserve_method: null })).toEqual({ kind: 'request' });
  });
  it('never offers a request for an email or link amenity, nor an unsafe link', () => {
    expect(amenityReserveAction({ allow_reservations: true, reserve_method: 'email', reservation_email: '' }).kind).toBe('none');
    expect(amenityReserveAction({ allow_reservations: true, reserve_method: 'platform_link', reservation_url: 'javascript:alert(1)' }).kind).toBe('none');
    expect(amenityReserveAction({ allow_reservations: false, reserve_method: null }).kind).toBe('none');
  });
  it('shows the price as staff set it', () => {
    expect(amenityPriceLabel('flat', 25)).toBe('Flat rate: $25.00');
    expect(amenityPriceLabel('hourly', '10')).toBe('Hourly: $10.00/hr');
    expect(amenityPriceLabel(null, 10)).toBeNull();
  });
  it('checks the opening hours', () => {
    expect(withinAmenityHours('10:00', '11:00', '08:00:00', '20:00:00')).toBe(true);
    expect(withinAmenityHours('07:30', '09:00', '08:00:00', '20:00:00')).toBe(false);
    expect(withinAmenityHours('19:00', '21:00', '08:00:00', '20:00:00')).toBe(false);
    expect(withinAmenityHours('19:00', '20:00', '08:00', '20:00')).toBe(true);
    expect(withinAmenityHours('23:00', '23:30', null, null)).toBe(true);
    // Hours past midnight are not checked here (nor by the database guard).
    expect(withinAmenityHours('23:00', '23:30', '18:00', '02:00')).toBe(true);
  });
});

describe('inspections list search', () => {
  it('cleans text the filter syntax treats specially', () => {
    expect(inspectionSearchTerm('  move-in, (annual) *50%  ')).toBe('move-in annual 50');
    expect(inspectionSearchTerm('x'.repeat(300))).toHaveLength(100);
  });
  it('matches the type or the related ids', () => {
    const a = '11111111-1111-4111-8111-111111111111';
    const n = '22222222-2222-4222-8222-222222222222';
    expect(inspectionSearchOr('annual', { associationIds: [a, a, 'bad'], unitIds: [], vendorIds: [], inspectionIds: [n] }))
      .toBe(`inspection_type.ilike."*annual*",association_id.in.(${a}),id.in.(${n})`);
  });
});

describe('vendor compliance tone', () => {
  it('a document is valid through its expiration date', () => {
    expect(expirationTone('2026-10-14', '2026-10-14')).toBe('warning');
    expect(expirationTone('2026-10-13', '2026-10-14')).toBe('danger');
    expect(expirationTone('2026-11-13', '2026-10-14')).toBe('warning');
    expect(expirationTone('2026-11-14', '2026-10-14')).toBe('success');
    expect(expirationTone(null, '2026-10-14')).toBe('neutral');
  });
  it('agrees with the company-admin status', () => {
    const vendor = { general_liability_expiration: '2026-10-13' };
    expect(vendorComplianceStatus(vendor, '2026-10-14')).toBe('expired');
    expect(expirationTone(vendor.general_liability_expiration, '2026-10-14')).toBe('danger');
  });
});

describe('selectInChunks', () => {
  it('looks ids up in chunks without repeats', async () => {
    const seen: string[][] = [];
    const ids = Array.from({ length: 450 }, (_, i) => `id-${i}`);
    const { rows, error } = await selectInChunks([...ids, ids[0], null], (chunk) => {
      seen.push(chunk);
      return { range: async () => ({ data: chunk.map((id) => ({ id })), error: null }) };
    });
    expect(error).toBeNull();
    expect(seen.map((c) => c.length)).toEqual([200, 200, 50]);
    expect(rows).toHaveLength(450);
  });
  it('reports a failed chunk', async () => {
    const { error } = await selectInChunks(['a'], () => ({ range: async () => ({ data: null, error: { message: 'boom' } }) }));
    expect(error).toBe('boom');
  });
});

describe('migration 20261015080000', () => {
  it('has no DELETE or DROP', () => {
    expect(SQL).not.toMatch(/\bdelete\s+from\b/i);
    expect(SQL).not.toMatch(/\bdrop\s+(table|policy|function|trigger|view|column|index)\b/i);
  });
  it('moves insurance notes to a staff-only table and clears the owner-readable column', () => {
    expect(SQL).toMatch(/create table if not exists public\.insurance_policy_private/);
    expect(SQL).toMatch(/alter table public\.insurance_policy_private enable row level security/);
    expect(SQL).toMatch(/revoke all on public\.insurance_policy_private from anon/);
    expect(SQL).toMatch(/policyname = 'mgr_assoc_scope'/);
    expect(SQL).toMatch(/before insert or update of notes on public\.insurance_policies/);
    expect(SQL).toMatch(/update public\.insurance_policies set notes = null where notes is not null/);
  });
  it('archives the earlier policy on renewal', () => {
    expect(SQL).toMatch(/after insert on public\.insurance_policies/);
    expect(SQL).toMatch(/p\.expiration_date < new\.expiration_date/);
  });
  it('uses the association calendar, not current_date', () => {
    expect(SQL).not.toMatch(/\bcurrent_date\b/i);
    expect(SQL).toMatch(/association_local_date/);
  });
  it('drops the per-row can_access_portfolio from the view and the per-row scope check from the read policy', () => {
    const view = SQL.slice(SQL.indexOf('create or replace view public.v_upcoming_expirations'), SQL.indexOf('create or replace view public.v_insurance_expirations'));
    expect(view).not.toMatch(/can_access_portfolio/);
    expect(view).toMatch(/security_invoker = true/);
    const start = SQL.indexOf('alter policy insurance_staff_tenant_all');
    expect(start).toBeGreaterThan(0);
    const using = SQL.slice(start, SQL.indexOf('with check (', start));
    expect(using).toMatch(/\(select rls_private\.my_accessible_association_ids\(\)\)/);
    expect(using).not.toMatch(/insurance_policy_scope_valid/);
  });
  it('keeps new functions away from anon and signed-in callers', () => {
    for (const fn of [
      'move_insurance_policy_private_fields()',
      'insurance_policies_supersede_earlier()',
      'insurance_policies_due_for_reminder(integer, uuid[])',
      'amenity_reservations_resident_insert_guard()',
      'inspection_items_self_service_guard()',
      'inspections_default_completed_date()',
    ]) {
      expect(SQL).toContain(`revoke all on function public.${fn} from public, anon, authenticated`);
    }
  });
  it('hides internal reminders from residents, guards amenity requests and vendor findings', () => {
    expect(SQL).toMatch(/'insurance_expiration'', ''contract_renewal'', ''assessment_deadline''/);
    expect(SQL).toMatch(/v_marker text := 'internal management reminders'/);
    expect(SQL).toMatch(/before insert on public\.amenity_reservations/);
    expect(SQL).toMatch(/am\.reserve_method is not null/);
    expect(SQL).toMatch(/before insert or update on public\.inspection_items/);
    expect(SQL).toMatch(/new\.work_order_id is distinct from old\.work_order_id/);
  });
});
