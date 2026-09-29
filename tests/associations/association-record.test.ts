import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSOCIATION_SECTIONS, allSettingKeys } from '@/lib/associations/settings-fields';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260929170000_association_record_completion.sql'), 'utf8');
const interest = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260929171000_association_interest_engine.sql'), 'utf8');

describe('association record', () => {
  it('every editable field is whitelisted by update_association_settings', () => {
    const allowed = migration.slice(migration.indexOf('allowed text[] := array['), migration.indexOf('];', migration.indexOf('allowed text[] := array[')));
    for (const key of allSettingKeys()) expect(allowed, key).toContain(`'${key}'`);
  });

  it('sections have unique keys and no duplicate fields', () => {
    expect(new Set(ASSOCIATION_SECTIONS.map((s) => s.key)).size).toBe(ASSOCIATION_SECTIONS.length);
    const keys = allSettingKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('rejects unknown fields and audits every change', () => {
    expect(migration).toContain("raise exception 'Unknown or protected field submitted'");
    expect(migration).toContain("'association_settings_updated'");
    expect(migration).toContain('public.can_manage_association(p_association_id)');
  });

  it('gives keys, notes and additional fees a permissive staff policy', () => {
    expect(migration).toContain("array['association_keys', 'association_notes', 'association_additional_fees']");
  });

  it('interest engine is idempotent, non-compounding, and service-role only', () => {
    expect(interest).toContain('unique (unit_id, period_month)');
    expect(interest).toContain('not exists (select 1 from public.interest_assessments ia where ia.charge_id = ch.id)');
    expect(interest).toContain('revoke all on function public.assess_association_interest(date) from public, anon, authenticated');
  });
});
