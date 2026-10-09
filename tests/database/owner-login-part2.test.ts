import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Owner login part 2: the owner portal reads every record of the login and
// each write names the exact record it is for. Migration 20261009060000.

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('owner login part 2: messages to management', () => {
  const sql = read('supabase/migrations/20261009060000_owner_message_per_record.sql');

  it('sends for a chosen record of the login only, and keeps the old call working', () => {
    expect(sql).toContain('p_subject text, p_body text, p_idempotency_key uuid, p_owner_id uuid)');
    expect(sql).toContain('and o.id in (select public.current_owner_ids())');
    expect(sql).toContain('and oc.association_id = owner_row.association_id');
    expect(sql).toContain('return public.submit_owner_message(p_subject, p_body, p_idempotency_key, public.current_owner_id());');
    expect(sql).toContain('revoke all on function public.submit_owner_message(text, text, uuid, uuid) from public, anon;');
    expect(sql).not.toMatch(/drop (function|policy|table)/i);
    // eslint-disable-next-line no-control-regex
    expect(sql).not.toMatch(/[^\x00-\x7f]/);
  });

  it('asks which association when the login has more than one', () => {
    const page = read('app/portal/communications/page.tsx');
    expect(page).toContain("if (!me2.owner_ids.includes(recordId))");
    expect(page).toContain('p_owner_id: recordId,');
    expect(page).toContain('records.length > 1 ?');
  });
});

describe('owner login part 2: portal reads and writes', () => {
  it('reads every record of the login', () => {
    for (const file of [
      'app/portal/architectural/page.tsx', 'app/portal/communications/page.tsx', 'app/portal/timeline/page.tsx',
      'app/portal/amenities/page.tsx', 'lib/portal/own-units.ts', 'lib/messages/resident-loaders.ts',
    ]) {
      expect(read(file), file).toMatch(/\.in\('owner_id', /);
    }
  });

  it('writes for the record that holds the unit', () => {
    expect(read('lib/portal/own-units.ts')).toContain('export async function ownerRecordForUnit(');
    for (const file of ['lib/rpcs/architectural.ts', 'lib/rpcs/service-requests.ts']) {
      expect(read(file), file).toContain('ownerRecordForUnit(');
      expect(read(file), file).toContain('holder.ownerId');
    }
    expect(read('app/portal/pay/actions.ts')).toContain('owner_id: occ.owner_id');
    expect(read('app/portal/amenities/page.tsx')).toContain('owner_id: occ.owner_id');
  });

  it('answers a survey as the record in the survey\'s association', () => {
    const surveys = read('lib/rpcs/surveys.ts');
    expect(surveys).toContain(".in('id', me.owner_ids).eq('association_id', survey.association_id)");
    expect(surveys).toContain('submitted_by_owner_id: owner.id,');
  });

  it('keeps insurance and contact details per record, checked against the login', () => {
    expect(read('lib/portal/owner-records.ts')).toContain('return me.owner_ids.includes(value) ? value : me.owner_id;');
    expect(read('lib/rpcs/insurance.ts')).toContain('return me.owner_ids.includes(ownerId) ? ownerId : null;');
    expect(read('app/portal/profile/page.tsx')).toContain('RecordSwitcher');
    expect(read('app/portal/insurance/page.tsx')).toContain('RecordSwitcher');
  });
});

describe('owner login part 2: staff side', () => {
  it('refuses an owner record of another association', () => {
    expect(read('lib/security/association-scope.ts')).toContain(
      "if (associationId && data.association_id !== associationId) return 'The selected owner is not in this association.';");
    expect(read('app/(app)/insurance/new/page.tsx')).toContain(".eq('id', ownerId).eq('association_id', associationId)");
    for (const file of ['app/(app)/calendar/new/page.tsx', 'app/(app)/owners/management-agreements/new/page.tsx']) {
      expect(read(file), file).toContain('<OwnerSelect');
    }
  });

  it('shows a record signed in through another association\'s login', () => {
    const page = read('app/(app)/owners/[id]/page.tsx');
    expect(page).toContain("db.from('owner_portal_logins')");
    expect(page).toContain(".eq('owner_id', id).is('revoked_at', null).maybeSingle(),");
  });
});
