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
    raise exception 'resident portal assertion failed: %', p_message;
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
  raise exception 'resident portal assertion failed: %', p_message;
end;
$function$;

insert into public.portfolios (id, company_name, slug, support_email)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Resident Test Management', 'resident-test', 'manager@example.test'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Other Management', 'other-test', 'other@example.test');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'resident@example.test',
  crypt('Resident-Test-Password-123!', gen_salt('bf')),
  now(), now(), now()
);

insert into public.profiles (id, email, full_name, portfolio_id, hoa_role)
values (
  '10000000-0000-0000-0000-000000000001',
  'resident@example.test',
  'Riley Resident',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'tenant'
)
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  portfolio_id = excluded.portfolio_id,
  hoa_role = excluded.hoa_role,
  disabled_at = null;

insert into public.associations (
  id, portfolio_id, name, address, city, state, zip, fiscal_year_start, created_by
) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Resident Test HOA', '1 Main St', 'Chicago', 'IL', '60601', 1, '10000000-0000-0000-0000-000000000001'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Other HOA', '2 Main St', 'Chicago', 'IL', '60602', 1, '10000000-0000-0000-0000-000000000001');

insert into public.buildings (id, association_id, name, address) values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Resident Building', '1 Main St'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Other Building', '2 Main St');

insert into public.units (id, building_id, unit_number, ownership_pct) values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', '101', 1),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', '202', 1);

insert into public.owners (id, portfolio_id, full_name, email, portal_activated) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Olivia Owner', 'resident@example.test', true);

insert into public.vendors (id, portfolio_id, name, emails, auth_user_id, portal_activated) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Resident Email Vendor', '["resident@example.test"]'::jsonb, '10000000-0000-0000-0000-000000000001', true);

insert into public.occupancies (id, owner_id, unit_id, association_id, occupancy_type, status) values
  ('f0000000-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'owner', 'current');

insert into public.tenants (
  id, portfolio_id, association_id, unit_id, owner_id, first_name, last_name,
  email, auth_user_id, portal_activated, status
) values
  ('20000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'Riley', 'Resident', 'resident@example.test', '10000000-0000-0000-0000-000000000001', true, 'active'),
  ('20000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', null, 'Taylor', 'Other', 'other@example.test', null, false, 'active');

insert into public.calendar_events (id, portfolio_id, association_id, title, start_datetime) values
  ('30000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Resident HOA Event', now() + interval '1 day'),
  ('30000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', null, 'Resident Portfolio Event', now() + interval '2 days'),
  ('30000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', null, 'Other Portfolio Event', now() + interval '3 days'),
  ('30000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Other HOA Event', now() + interval '4 days');

insert into public.documents (id, entity_type, entity_id, doc_type, file_name, file_url) values
  ('40000000-0000-0000-0000-000000000001', 'association', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'declaration_ccrs', 'Resident Declaration.pdf', 'associations/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1/declaration.pdf'),
  ('40000000-0000-0000-0000-000000000002', 'association', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'declaration_ccrs', 'Other Declaration.pdf', 'associations/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2/declaration.pdf'),
  ('40000000-0000-0000-0000-000000000003', 'owner', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'other', 'Owner Statement.pdf', 'owners/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1/statement.pdf'),
  ('40000000-0000-0000-0000-000000000004', 'association', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'other', 'Private Delinquency Letter.pdf', 'associations/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1/delinquency.pdf'),
  ('40000000-0000-0000-0000-000000000005', 'association', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'bylaws', 'Mismatched Path.pdf', 'associations/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2/mismatched.pdf');

insert into public.meetings (id, portfolio_id, association_id, title, meeting_type, status, minutes) values
  ('41000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Open Board Meeting', 'board_meeting', 'completed', 'Approved public minutes'),
  ('41000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Executive Session', 'executive_session', 'completed', 'Confidential minutes'),
  ('41000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Other HOA Meeting', 'board_meeting', 'completed', 'Other minutes');

insert into public.surveys (id, portfolio_id, name, active) values
  ('42000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Resident Portfolio Survey', true),
  ('42000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Other Portfolio Survey', true);

insert into public.charge_categories (id, portfolio_id, association_id, name, active) values
  ('43000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Resident HOA Assessments', true),
  ('43000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Other HOA Assessments', true);

insert into public.charges (id, unit_id, description, amount, due_date) values
  ('50000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'Owner assessment', 250, current_date);

insert into public.payments (id, unit_id, amount) values
  ('60000000-0000-0000-0000-000000000001', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 100);

insert into public.statements (id, owner_id, unit_id, association_id, period_month, period_year) values
  ('70000000-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 8, 2026);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select pg_temp.assert_true(public.is_tenant_user(), 'linked active tenant must be recognized');
select pg_temp.assert_true(public.current_tenant_id() = '20000000-0000-0000-0000-000000000001', 'current tenant id must be deterministic');
select pg_temp.assert_true((public.me()->>'tenant_id')::uuid = '20000000-0000-0000-0000-000000000001', 'me() must expose the tenant link');
select pg_temp.assert_true(public.current_owner_id() is null, 'a tenant role must never inherit owner access from a matching email');
select pg_temp.assert_true(public.current_vendor_id() is null, 'a tenant role must never inherit vendor access from a matching email');
select pg_temp.assert_true((select count(*) = 1 from public.tenants), 'resident may read only their own tenant row');
select pg_temp.assert_true((select count(*) = 1 from public.associations), 'resident may read only their association');
select pg_temp.assert_true((select count(*) = 1 from public.buildings), 'resident may read only their building');
select pg_temp.assert_true((select count(*) = 1 from public.units), 'resident may read only their unit');
select pg_temp.assert_true((select count(*) = 2 from public.calendar_events), 'resident may read association and portfolio events but not another portfolio');
select pg_temp.assert_true((select count(*) = 1 from public.documents), 'resident may read only allowlisted, path-valid association documents');
select pg_temp.assert_true((select count(*) = 1 from public.meetings), 'resident may read open meeting records but not executive sessions or another association');
select pg_temp.assert_true((select count(*) = 0 from public.surveys), 'tenant role must not inherit owner survey access');
select pg_temp.assert_true((select count(*) = 0 from public.charge_categories), 'tenant role must not inherit owner accounting-category access');

select pg_temp.assert_true((select count(*) = 0 from public.charges), 'resident must not read owner charges');
select pg_temp.assert_true((select count(*) = 0 from public.payments), 'resident must not read owner payments');
select pg_temp.assert_true((select count(*) = 0 from public.statements), 'resident must not read owner statements');
select pg_temp.assert_true((select count(*) = 0 from public.owners), 'resident must not read the owner record');
select pg_temp.assert_raises(
  $$select public.calculate_meeting_quorum('41000000-0000-0000-0000-000000000001')$$,
  'tenant must not be able to mutate meeting quorum'
);
select pg_temp.assert_raises(
  $$select public.submit_tenant_service_request(
    'dddddddd-dddd-dddd-dddd-ddddddddddd2',
    'Attempt outside the resident unit.',
    'normal',
    false,
    null
  )$$,
  'resident service-request RPC must reject another portfolio unit'
);

select pg_temp.assert_true(
  public.submit_tenant_service_request(
    'dddddddd-dddd-dddd-dddd-ddddddddddd1',
    'The kitchen faucet has an active slow leak.',
    'normal',
    true,
    'Please call before entering.'
  ) is not null,
  'resident must be able to submit a scoped maintenance request'
);
select pg_temp.assert_true((select count(*) = 1 from public.service_requests), 'resident may read their own request');
select pg_temp.assert_true(
  public.cancel_tenant_service_request((select id from public.service_requests limit 1)),
  'resident must be able to cancel an untriaged request'
);
select pg_temp.assert_true((select status = 'cancelled' from public.service_requests limit 1), 'cancel RPC must change only the request status');

select pg_temp.assert_true(
  public.update_tenant_portal_profile(
    '20000000-0000-0000-0000-000000000001',
    '312-555-0101',
    'Emergency Contact',
    '312-555-0102',
    'POLICY-100',
    '2027-08-01'
  ),
  'resident must be able to update approved profile fields'
);
select pg_temp.assert_true((select phone = '312-555-0101' from public.tenants limit 1), 'profile RPC must persist the approved field');

reset role;
update public.tenants
set association_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'
where id = '20000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.assert_true((select count(*) = 0 from public.associations), 'a mismatched tenant association must fail closed');
select pg_temp.assert_true((select count(*) = 0 from public.units), 'a mismatched tenant unit chain must fail closed');

reset role;
update public.tenants
set association_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    auth_user_id = null,
    portal_activated = false
where id = '20000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.assert_true(not public.is_tenant_user(), 'disabled resident access must fail closed at the database boundary');
select pg_temp.assert_true((select count(*) = 0 from public.tenants), 'disabled resident must not read the prior tenant row');
select pg_temp.assert_true((select count(*) = 0 from public.documents), 'disabled resident must not read community documents');

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
) values (
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'manager@example.test',
  crypt('Manager-Test-Password-123!', gen_salt('bf')),
  now(), now(), now()
);
insert into public.profiles (id, email, full_name, portfolio_id, hoa_role, mvp_role)
values (
  '10000000-0000-0000-0000-000000000002',
  'manager@example.test',
  'Morgan Manager',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  'manager',
  'manager'
)
on conflict (id) do update set
  portfolio_id = excluded.portfolio_id,
  hoa_role = excluded.hoa_role,
  mvp_role = excluded.mvp_role,
  disabled_at = null;
insert into public.association_managers (user_id, association_id, portfolio_id)
values (
  '10000000-0000-0000-0000-000000000002',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
);
insert into public.service_requests (
  id, portfolio_id, association_id, unit_id, tenant_id, description, priority, source, status
) values
  ('44000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'dddddddd-dddd-dddd-dddd-ddddddddddd1', '20000000-0000-0000-0000-000000000001', 'Manager should triage this request.', 'high', 'resident', 'open'),
  ('44000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'dddddddd-dddd-dddd-dddd-ddddddddddd2', '20000000-0000-0000-0000-000000000002', 'Out of scope request.', 'normal', 'resident', 'open');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.assert_true(
  public.triage_service_request_to_work_order('44000000-0000-0000-0000-000000000001') is not null,
  'assigned manager must be able to triage a service request atomically'
);
select pg_temp.assert_true(
  (select count(*) = 1 from public.work_orders where service_request_id = '44000000-0000-0000-0000-000000000001'),
  'triage must create exactly one linked work order'
);
select pg_temp.assert_true(
  public.triage_service_request_to_work_order('44000000-0000-0000-0000-000000000001') =
    (select id from public.work_orders where service_request_id = '44000000-0000-0000-0000-000000000001'),
  'repeated triage must return the existing work order instead of duplicating it'
);
select pg_temp.assert_true(
  (select status = 'waiting' from public.service_requests where id = '44000000-0000-0000-0000-000000000001'),
  'triage must move the service request into an acknowledged state'
);
select pg_temp.assert_raises(
  $$select public.triage_service_request_to_work_order('44000000-0000-0000-0000-000000000002')$$,
  'manager must not triage another portfolio service request'
);

select extensions.pass('resident portal identity, RLS, financial isolation, and self-service assertions');
select * from extensions.finish();
rollback;
