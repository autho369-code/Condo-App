import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Regression guards for queries that were failing in production (found by
// `npm run check:queries`). Each one made its whole page section fail.
const read = (p: string) => readFileSync(p, 'utf8');

describe('queries fixed in the 2026-09-29 health check', () => {
  it('maintenance reminders read vendor contacts from the jsonb lists and fail loudly', () => {
    const src = read('lib/maintenance/reminders.ts');
    expect(src).toContain('vendors(name, emails, phone_numbers)');
    expect(src).not.toMatch(/vendors\(name, email, phone\)/);
    expect(src).toContain('maintenance reminder lookup failed');
  });

  it('reaches associations from units through buildings', () => {
    expect(read('app/(app)/charges/page.tsx')).toContain('units!inner(unit_number, buildings!inner(association_id))');
    expect(read('app/api/bulk/units/route.ts')).toContain('buildings!inner(associations!inner(name))');
    expect(read('app/(app)/letters/[id]/preview/page.tsx')).toContain('units(unit_number, buildings(association_id))');
  });

  it('uses the parking space label column', () => {
    expect(read('app/(app)/owners/[id]/page.tsx')).not.toContain('space_number');
    expect(read('app/(app)/reports/[slug]/page.tsx')).not.toContain('space_number');
  });

  it('does not embed profiles through inspector_user_id (auth.users FK)', () => {
    expect(read('app/(app)/inspections/[id]/page.tsx')).not.toContain('profiles:inspector_user_id');
  });

  it('disambiguates the bank account -> association embed', () => {
    expect(read('app/(app)/reports/[slug]/page.tsx')).toContain('associations!bank_accounts_association_id_fkey(name)');
  });

  it('adds the calendar-event foreign keys the Automation Center embeds rely on', () => {
    const sql = read('supabase/migrations/20260929230000_automation_calendar_foreign_keys.sql');
    expect(sql).toContain('calendar_event_reminders_calendar_event_id_fkey');
    expect(sql).toContain('automation_tasks_calendar_event_id_fkey');
    expect(sql).toContain("notify pgrst, 'reload schema'");
  });
});
