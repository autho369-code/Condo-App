\set ON_ERROR_STOP on

create extension if not exists pgtap with schema extensions;
begin;
select extensions.plan(1);

create or replace function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $function$
begin
  if coalesce(p_condition, false) is not true then
    raise exception 'meeting governance assertion failed: %', p_message;
  end if;
end;
$function$;

create or replace function pg_temp.assert_raises(p_sql text, p_message text)
returns void
language plpgsql
as $function$
begin
  begin
    execute p_sql;
  exception when others then
    return;
  end;
  raise exception 'meeting governance assertion failed: %', p_message;
end;
$function$;

insert into public.portfolios (id, company_name, slug, support_email)
values
  ('a7000000-0000-0000-0000-000000000001', 'Governance Test Management', 'governance-test', 'governance@example.test'),
  ('a7000000-0000-0000-0000-000000000002', 'Outside Test Management', 'governance-other', 'other@example.test');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values
  ('a7100000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'governance-manager@example.test', crypt('Manager-Test-Password-123!', gen_salt('bf')), now(), now(), now()),
  ('a7100000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'governance-admin@example.test', crypt('Admin-Test-Password-123!', gen_salt('bf')), now(), now(), now()),
  ('a7100000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'governance-board@example.test', crypt('Board-Test-Password-123!', gen_salt('bf')), now(), now(), now()),
  ('a7100000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'governance-owner@example.test', crypt('Owner-Test-Password-123!', gen_salt('bf')), now(), now(), now());

insert into public.profiles (id, email, full_name, portfolio_id, hoa_role, mvp_role)
values
  ('a7100000-0000-0000-0000-000000000001', 'governance-manager@example.test', 'Legacy Assigned Manager', 'a7000000-0000-0000-0000-000000000001', 'manager', null),
  ('a7100000-0000-0000-0000-000000000002', 'governance-admin@example.test', 'Legacy Company Admin', 'a7000000-0000-0000-0000-000000000001', 'company_admin', null),
  ('a7100000-0000-0000-0000-000000000003', 'governance-board@example.test', 'Board Director', 'a7000000-0000-0000-0000-000000000001', 'board', null),
  ('a7100000-0000-0000-0000-000000000004', 'governance-owner@example.test', 'Current Owner', 'a7000000-0000-0000-0000-000000000001', 'owner', null)
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  portfolio_id = excluded.portfolio_id,
  hoa_role = excluded.hoa_role,
  mvp_role = excluded.mvp_role,
  disabled_at = null;

insert into public.associations (
  id, portfolio_id, name, address, city, state, zip, fiscal_year_start, created_by
) values
  ('a7200000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'Governance Test HOA', '1 Board Way', 'Chicago', 'IL', '60601', 1, 'a7100000-0000-0000-0000-000000000002'),
  ('a7200000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000002', 'Outside Test HOA', '2 Board Way', 'Chicago', 'IL', '60602', 1, 'a7100000-0000-0000-0000-000000000002');

insert into public.buildings (id, association_id, name, address)
values ('a7250000-0000-0000-0000-000000000001', 'a7200000-0000-0000-0000-000000000001', 'Owner Test Building', '1 Board Way');

insert into public.units (id, building_id, unit_number, ownership_pct)
values ('a7260000-0000-0000-0000-000000000001', 'a7250000-0000-0000-0000-000000000001', '101', 1);

insert into public.owners (id, portfolio_id, full_name, email, auth_user_id, portal_activated)
values ('a7270000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'Current Owner', 'governance-owner@example.test', 'a7100000-0000-0000-0000-000000000004', true);

insert into public.occupancies (id, owner_id, unit_id, association_id, occupancy_type, status)
values ('a7280000-0000-0000-0000-000000000001', 'a7270000-0000-0000-0000-000000000001', 'a7260000-0000-0000-0000-000000000001', 'a7200000-0000-0000-0000-000000000001', 'owner', 'current');

insert into public.association_managers (user_id, association_id, portfolio_id)
values ('a7100000-0000-0000-0000-000000000001', 'a7200000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001');

insert into public.board_members (id, association_id, auth_user_id, full_name, email, role, active)
values ('a7300000-0000-0000-0000-000000000001', 'a7200000-0000-0000-0000-000000000001', 'a7100000-0000-0000-0000-000000000003', 'Board Director', 'governance-board@example.test', 'director', true);

insert into public.meetings (id, portfolio_id, association_id, title, meeting_type, status)
values
  ('a7400000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'a7200000-0000-0000-0000-000000000001', 'Governance Test Meeting', 'board_meeting', 'scheduled'),
  ('a7400000-0000-0000-0000-000000000002', 'a7000000-0000-0000-0000-000000000002', 'a7200000-0000-0000-0000-000000000002', 'Outside Test Meeting', 'board_meeting', 'scheduled');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a7100000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_true(
  public.can_edit_association_mvp('a7200000-0000-0000-0000-000000000001'),
  'an assigned legacy manager must retain the canonical association write boundary'
);
select pg_temp.assert_true(
  not public.can_edit_association_mvp('a7200000-0000-0000-0000-000000000002'),
  'an assigned manager must not edit another tenant association'
);

insert into public.agenda_items (id, meeting_id, title, sort_order)
values ('a7500000-0000-0000-0000-000000000001', 'a7400000-0000-0000-0000-000000000001', 'Call to order', 0);
insert into public.meeting_documents (id, meeting_id, name, storage_path, uploaded_by)
values ('a7600000-0000-0000-0000-000000000001', 'a7400000-0000-0000-0000-000000000001', 'Board packet.pdf', 'meetings/a7400000-0000-0000-0000-000000000001/packet.pdf', 'a7100000-0000-0000-0000-000000000001');
insert into public.meeting_action_items (id, meeting_id, title, assigned_to, created_by)
values ('a7700000-0000-0000-0000-000000000001', 'a7400000-0000-0000-0000-000000000001', 'Obtain revised proposal', 'Property Manager', 'a7100000-0000-0000-0000-000000000001');

select pg_temp.assert_raises(
  $$insert into public.agenda_items (meeting_id, title) values ('a7400000-0000-0000-0000-000000000002', 'Forged agenda item')$$,
  'an assigned manager must not add an agenda item outside the assigned association'
);
select pg_temp.assert_raises(
  $$insert into public.meeting_documents (meeting_id, name, storage_path, uploaded_by) values ('a7400000-0000-0000-0000-000000000001', 'Wrong path.pdf', 'meetings/a7400000-0000-0000-0000-000000000002/wrong.pdf', 'a7100000-0000-0000-0000-000000000001')$$,
  'meeting document metadata must match the meeting-scoped private object path'
);
select pg_temp.assert_raises(
  $$insert into public.meeting_action_items (meeting_id, title, created_by) values ('a7400000-0000-0000-0000-000000000002', 'Forged action', 'a7100000-0000-0000-0000-000000000001')$$,
  'an assigned manager must not add an action to another tenant meeting'
);

reset role;
select set_config('request.jwt.claim.sub', 'a7100000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select pg_temp.assert_true(
  public.can_edit_association_mvp('a7200000-0000-0000-0000-000000000001'),
  'a legacy company-admin identity must retain portfolio association write access'
);
insert into public.agenda_items (id, meeting_id, title, sort_order)
values ('a7500000-0000-0000-0000-000000000002', 'a7400000-0000-0000-0000-000000000001', 'Treasurer report', 1);

reset role;
select set_config('request.jwt.claim.sub', 'a7100000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select public.reorder_agenda_items(
  'a7400000-0000-0000-0000-000000000001',
  array['a7500000-0000-0000-0000-000000000002'::uuid, 'a7500000-0000-0000-0000-000000000001'::uuid]
);
select pg_temp.assert_true(
  (select sort_order = 0 from public.agenda_items where id = 'a7500000-0000-0000-0000-000000000002'),
  'agenda reorder must persist a complete authorized permutation'
);
select pg_temp.assert_raises(
  $$select public.reorder_agenda_items('a7400000-0000-0000-0000-000000000001', array['a7500000-0000-0000-0000-000000000001'::uuid])$$,
  'agenda reorder must reject a partial item set'
);

update public.meeting_action_items
set status = 'completed', completed_by = 'a7100000-0000-0000-0000-000000000002'
where id = 'a7700000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  (select status = 'completed'
      and completed_at is not null
      and completed_by = 'a7100000-0000-0000-0000-000000000001'
   from public.meeting_action_items
   where id = 'a7700000-0000-0000-0000-000000000001'),
  'completion evidence must be stamped from the authenticated manager instead of trusting submitted identity'
);
update public.meeting_action_items
set meeting_id = 'a7400000-0000-0000-0000-000000000002',
    created_by = 'a7100000-0000-0000-0000-000000000002'
where id = 'a7700000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  (select meeting_id = 'a7400000-0000-0000-0000-000000000001'
      and created_by = 'a7100000-0000-0000-0000-000000000001'
   from public.meeting_action_items
   where id = 'a7700000-0000-0000-0000-000000000001'),
  'action identity and creator evidence must be immutable'
);

reset role;
select set_config('request.jwt.claim.sub', 'a7100000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select pg_temp.assert_true((select count(*) = 2 from public.agenda_items), 'board must read its structured agenda');
select pg_temp.assert_true((select count(*) = 1 from public.meeting_documents), 'board must read its meeting-document metadata');
select pg_temp.assert_true((select count(*) = 1 from public.meeting_action_items), 'board must read its follow-up actions');
select pg_temp.assert_raises(
  $$insert into public.agenda_items (meeting_id, title) values ('a7400000-0000-0000-0000-000000000001', 'Board mutation attempt')$$,
  'board members must not mutate the management-controlled agenda'
);
select pg_temp.assert_raises(
  $$select public.reorder_agenda_items('a7400000-0000-0000-0000-000000000001', array['a7500000-0000-0000-0000-000000000002'::uuid, 'a7500000-0000-0000-0000-000000000001'::uuid])$$,
  'board members must not invoke the agenda mutation RPC'
);

reset role;
select set_config('request.jwt.claim.sub', 'a7100000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select pg_temp.assert_true(
  public.can_access_association_mvp('a7200000-0000-0000-0000-000000000001'),
  'the fixture owner must retain ordinary resident association access'
);
select pg_temp.assert_true(
  not public.can_access_confidential_meeting_mvp('a7200000-0000-0000-0000-000000000001'),
  'current owners must be excluded from confidential meeting governance access'
);
select pg_temp.assert_true((select count(*) = 0 from public.agenda_items), 'owners must not read board agenda items');
select pg_temp.assert_true((select count(*) = 0 from public.meeting_documents), 'owners must not read private meeting-document metadata');
select pg_temp.assert_true((select count(*) = 0 from public.meeting_action_items), 'owners must not read board follow-up actions');

select extensions.pass('meeting governance RLS, tenant scope, board visibility, and follow-up assertions');
select * from extensions.finish();
rollback;
