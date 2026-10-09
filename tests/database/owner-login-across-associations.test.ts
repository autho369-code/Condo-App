import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// One owner login reaches every owner record whose invitation it accepted
// (one record per association). Migration 20261009050000.

const root = process.cwd();
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const migration = read('supabase/migrations/20261009050000_owner_login_across_associations.sql');
const fn = (name: string) => {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  const body = migration.slice(start);
  return body.slice(0, body.indexOf('$function$;') + 11);
};

describe('owner login across associations: database', () => {
  it('keeps the added records in their own table with RLS and no user writes', () => {
    expect(migration).toContain('create table if not exists public.owner_portal_logins');
    expect(migration).toContain('alter table public.owner_portal_logins enable row level security;');
    expect(migration).toContain('revoke all on public.owner_portal_logins from public, anon, authenticated;');
    expect(migration).toContain('grant select on public.owner_portal_logins to authenticated;');
    expect(migration).not.toMatch(/create policy [a-z_]+ on public\.owner_portal_logins for (insert|update|delete|all)/);
    expect(migration).toContain('using (auth_user_id = (select auth.uid()) and revoked_at is null);');
    expect(migration).toContain('and public.can_access_portfolio(own.portfolio_id)');
  });

  it('resolves the login to its linked record plus accepted ones, never by email', () => {
    const helper = fn('current_owner_ids');
    expect(helper).toContain('o.auth_user_id = auth.uid()');
    expect(helper).toContain('l.owner_id = o.id and l.auth_user_id = auth.uid() and l.revoked_at is null');
    expect(helper).toContain('and o.portal_activated');
    expect(helper).not.toMatch(/email/);
    expect(fn('current_owner_id')).toContain('return (select x from public.current_owner_ids() x limit 1);');
  });

  it('rewrites every single-record policy and refuses to finish if one is left', () => {
    expect(migration).toContain("v_pattern constant text := '= (public\\.)?current_owner_id\\(\\)';");
    expect(migration).toContain("regexp_replace(r.qual, v_pattern, 'IN ( SELECT public.current_owner_ids())', 'g')");
    expect(migration).toContain("regexp_replace(r.with_check, v_pattern, 'IN ( SELECT public.current_owner_ids())', 'g')");
    expect(migration).toContain("raise exception 'A policy still compares with current_owner_id(). Check it, then run this migration again.';");
    expect(migration).not.toMatch(/drop (policy|function|table|trigger)/i);
    expect(migration).not.toMatch(/delete from/i);
  });

  it('checks every replaced function against all records, never "the" one', () => {
    for (const name of [
      'current_resident_unit_ids', 'current_resident_association_ids', 'current_resident_unit_since', 'is_notice_recipient',
      'amenity_reservations_owner_guard', 'architectural_requests_owner_guard', 'board_decide_architectural_request',
      'cancel_autopay', 'cast_board_approval', 'message_thread_access', 'owner_unit_tenants', 'rate_work_order',
      'enroll_autopay', 'owner_update_tenant_lease', 'request_owner_violation_hearing', 'start_resident_message_thread',
      'record_meeting_attendance_tenant_checked_impl',
    ]) {
      const body = fn(name);
      expect(body, name).toContain('in (select public.current_owner_ids())');
      expect(body, name).not.toMatch(/current_owner_id\(\)/);
    }
  });

  it('acts for the exact record the target belongs to', () => {
    expect(fn('enroll_autopay')).toContain('where pm.id = p_payment_method_id and pm.owner_id = v_owner and pm.archived_at is null');
    expect(fn('owner_update_tenant_lease')).toContain('where occ.owner_id = t.owner_id and occ.unit_id = t.unit_id');
    expect(fn('record_meeting_attendance_tenant_checked_impl')).toContain('and o.association_id = v_meeting.association_id');
    expect(fn('start_resident_message_thread')).toContain('where o.unit_id = p_unit');
  });

  it('links exactly the invited record on accept', () => {
    const link = fn('link_owner_on_invitation_accept');
    expect(link).toContain("v_owner := (new.metadata ->> 'owner_id')::uuid;");
    expect(link).toContain('where o.id = v_owner');
    // An older owner invitation naming no record: exactly one unlinked record of that email, or it fails.
    expect(link).toContain("raise exception 'This owner invitation does not identify one owner record. Ask the management office for a new invitation.'");
    expect(link).toContain('and o.auth_user_id is null');
    expect(link).toContain('and o.association_id = v_assoc');
    expect(link).toContain('where u.id = new.used_by and lower(btrim(u.email)) = lower(btrim(new.email))');
    expect(link).toContain('and (o.auth_user_id = new.used_by');
    // The success check and the re-activation both require the record's current email and company.
    expect(link.match(/and lower\(btrim\(o\.email\)\) = lower\(btrim\(new\.email\)\)/g)?.length).toBeGreaterThanOrEqual(4);
    // Nothing linked = the acceptance rolls back (the invitation stays usable).
    expect(link).toContain("raise exception 'The invited owner record could not be linked to this account. Ask the management office for a new invitation.'");
    expect(link).toContain("raise exception 'This owner invitation cannot be used by this account. Ask the management office for a new invitation.'");
    expect(link).toContain('lower(btrim(o.email)) = lower(btrim(new.email))');
    expect(link).toContain('where public.owner_portal_logins.revoked_at is not null;');
    expect(migration).toContain('revoke all on function public.link_owner_on_invitation_accept() from public, anon, authenticated;');
    expect(migration).toContain('after update of status on public.user_invitations');
  });

  it('never links an owner record by email: not at sign-up, not in the bulk relink, not on an email change', () => {
    expect(fn('link_portal_user')).not.toContain('update public.owners');
    const relink = fn('relink_all_portal_users');
    expect(relink).toContain('n_owners := 0;');
    expect(relink).not.toContain('update public.owners');
    expect(fn('auto_link_portal_user')).toContain('perform public.link_portal_user(new.id, new.email);');
    const onEmail = fn('relink_portal_user_on_email_change');
    // The old body called the trigger function directly (always failed).
    expect(onEmail).not.toContain('perform public.auto_link_portal_user()');
    expect(onEmail).not.toContain('perform public.link_portal_user');
    expect(onEmail).toContain('update public.owner_portal_logins l set revoked_at = now()');
    expect(migration).toContain('revoke all on function public.link_portal_user(uuid, text) from public, anon, authenticated;');
  });

  it('ties every owner write to the association of the record it names', () => {
    expect(fn('owner_record_matches')).toContain('(p_unit_id is null or public.unit_association_id(p_unit_id) = o.association_id)');
    expect(migration).toContain("and p.cmd in ('INSERT', 'UPDATE', 'ALL')");
    expect(migration).toContain("AND public.owner_record_matches(\\1, ' || v_assoc || ', ' || v_unit || '))'");
    expect(migration).toContain("raise exception 'An owner write policy is not tied to its record''s association.';");
    expect(migration).toContain('else public.owner_record_matches(survey_responses.submitted_by_owner_id, s.association_id, null)');
  });

  it('keeps a board member on board when they accept an owner invitation', () => {
    expect(fn('profiles_keep_board_role')).toContain("new.hoa_role := 'board';");
    expect(migration).toContain("for each row when (old.hoa_role::text = 'board' and new.hoa_role::text = 'owner')");
    expect(migration).toContain('revoke all on function public.profiles_keep_board_role() from public, anon, authenticated;');
  });

  it('lets a scoped manager invite only into owner records of their own associations', () => {
    expect(migration).toContain('create policy owner_invite_scope on public.user_invitations as restrictive for insert to authenticated');
    expect(migration).toContain('create policy owner_invite_scope_update on public.user_invitations as restrictive for update to authenticated');
    expect(migration).toContain('and own.association_id = user_invitations.association_id');
  });

  it('returns every record from me()', () => {
    expect(migration).toContain("'owner_ids', array(select public.current_owner_ids()),");
    expect(migration).toContain("'vendor_ids', array(select public.current_vendor_ids()),");
  });
});

describe('owner login across associations: app', () => {
  it('names the exact owner record on every owner invitation', () => {
    const invite = read('lib/auth/owner-invitation.ts');
    expect(invite).toContain("metadata: { email_delivery: 'application', owner_id: input.ownerId },");
    expect(invite).toContain('association_id: input.associationId,');
    expect(read('app/(app)/owners/forms/page.tsx')).toContain('metadata: { owner_id: owner.id },');
    for (const file of ['lib/rpcs/owner-invitations.ts', 'lib/rpcs/entities.ts', 'app/(app)/owners/new/actions.ts']) {
      expect(read(file), file).toMatch(/ownerId[,:]/);
    }
  });

  it('keeps the person\'s invitations for other associations when re-inviting one record', () => {
    expect(read('lib/rpcs/owner-invitations.ts')).toContain('.or(`metadata->>owner_id.eq.${o.id},metadata->>owner_id.is.null`)');
    const forms = read('app/(app)/owners/forms/page.tsx');
    expect(forms).toContain('.or(`metadata->>owner_id.eq.${owner.id},metadata->>owner_id.is.null`)');
    // The older links are revoked only once the new one exists, and a failure is reported.
    expect(forms.indexOf(".insert({\n        portfolio_id: owner.portfolio_id,")).toBeLessThan(forms.indexOf(".update({ status: 'revoked'"));
    expect(forms).toContain('if (revokeErr) {');
    expect(forms).toContain(".lt('created_at', invitation.created_at)");
    expect(read('lib/rpcs/owner-invitations.ts')).toContain(".lt('created_at', result.createdAt)");
  });

  it('lets staff reset and re-enable a record added to a login', () => {
    const actions = read('app/(app)/owners/[id]/occupancy-actions.ts');
    expect(actions).toContain(".from('owner_portal_logins')");
    expect(actions).toContain('const signInId = await ownerSignInId(supabase, owner);');
    expect(actions).toContain('if (enable && !(await ownerSignInId(supabase, owner))) {');
  });

  it('exposes every record of the login', () => {
    const me = read('lib/auth/me.ts');
    expect(me).toContain('owner_ids: string[];');
    expect(me).toContain("if (!me.owner_id || !me.owner_ids?.length) redirect('/login?mode=owner');");
  });
});
