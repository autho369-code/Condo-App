-- Board officer permission tiers (configurable per association).
--
-- Each association decides what each board role (president, vice_president,
-- secretary, treasurer, director) may do in the board portal:
--   vote_approvals    vote on approval requests (bills, POs, contracts, budgets…)
--   view_financials   ledger, bank balances, bills, budget, reserves, year-end
--   view_delinquency  owner charges, payments, balances and collection cases
--   comment_cases     comment on violations, ARC requests and work orders
-- A missing row means ALLOWED, so every association keeps today's behaviour
-- until staff restrict a role. Enforcement is in the database: the board's
-- read policies, comment insert policies and cast_board_approval all consult
-- the permission, so the portal UI is not the only gate.
--
-- Also fixes two pre-existing holes found while mapping board access:
--   * board_comments accepted inserts from ANY signed-in user into ANY
--     association (the check was only author_id = auth.uid()).
--   * board users could insert approval_decisions rows directly, bypassing
--     cast_board_approval's eligible-voter check while still being counted in
--     its tally. The app only ever votes through the RPC.

create table if not exists public.board_role_permissions (
  association_id uuid not null references public.associations(id) on delete cascade,
  role public.board_role not null,
  permission text not null
    check (permission in ('vote_approvals', 'view_financials', 'view_delinquency', 'comment_cases')),
  allowed boolean not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (association_id, role, permission)
);
alter table public.board_role_permissions enable row level security;
revoke all on public.board_role_permissions from anon;

-- ------------------------------------------------------------ helpers
-- The caller's active seats (linked by user id, or by email while unlinked —
-- the same matching current_board_association_ids() uses).
create or replace function public.current_board_association_ids_with(p_permission text)
returns setof uuid
language sql stable security definer set search_path = pg_catalog, public as $$
  select a.id
    from public.current_board_association_ids() as a(id)
   where exists (
     select 1
       from public.board_members bm
       left join public.board_role_permissions brp
         on brp.association_id = bm.association_id and brp.role = bm.role and brp.permission = p_permission
      where bm.association_id = a.id
        and bm.active
        and (bm.auth_user_id = (select auth.uid())
             or (bm.auth_user_id is null
                 and lower(bm.email) = (select lower(u.email) from auth.users u where u.id = (select auth.uid()))))
        and coalesce(brp.allowed, true));
$$;

create or replace function public.board_member_can(p_board_member_id uuid, p_permission text)
returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1
      from public.board_members bm
      left join public.board_role_permissions brp
        on brp.association_id = bm.association_id and brp.role = bm.role and brp.permission = p_permission
     where bm.id = p_board_member_id
       and coalesce(brp.allowed, true));
$$;

create or replace function public.journal_entry_touches_board_financials(p_entry uuid)
returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.journal_lines jl
     where jl.entry_id = p_entry
       and jl.association_id in (select public.current_board_association_ids_with('view_financials')));
$$;

-- What the signed-in board member may do, per association (drives the portal UI).
create or replace function public.my_board_permissions()
returns table (association_id uuid, permission text, allowed boolean)
language sql stable security definer set search_path = pg_catalog, public as $$
  select a.id, p.permission,
         a.id in (select public.current_board_association_ids_with(p.permission))
    from public.current_board_association_ids() as a(id)
   cross join (values ('vote_approvals'), ('view_financials'), ('view_delinquency'), ('comment_cases')) as p(permission);
$$;

-- Staff save the whole matrix for one association.
create or replace function public.set_board_role_permissions(p_association_id uuid, p_permissions jsonb)
returns void
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid;
  e jsonb;
begin
  select portfolio_id into v_pid from public.associations where id = p_association_id and archived_at is null;
  if v_pid is null or not public.can_manage_association(p_association_id) then
    raise exception 'You do not manage this association' using errcode = '42501';
  end if;
  if jsonb_typeof(p_permissions) is distinct from 'array' then
    raise exception 'Permissions must be a list' using errcode = '22023';
  end if;
  for e in select * from jsonb_array_elements(p_permissions) loop
    if (e->>'role') is null or (e->>'role') not in ('president', 'vice_president', 'secretary', 'treasurer', 'director')
       or (e->>'permission') not in ('vote_approvals', 'view_financials', 'view_delinquency', 'comment_cases')
       or jsonb_typeof(e->'allowed') is distinct from 'boolean' then
      raise exception 'Invalid permission entry: %', e using errcode = '22023';
    end if;
    insert into public.board_role_permissions (association_id, role, permission, allowed, updated_by, updated_at)
    values (p_association_id, (e->>'role')::public.board_role, e->>'permission', (e->>'allowed')::boolean, (select auth.uid()), now())
    on conflict (association_id, role, permission) do update
      set allowed = excluded.allowed, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  end loop;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'association', p_association_id, 'board_role_permissions_updated', (select auth.uid()),
          (select email from auth.users where id = (select auth.uid())), jsonb_build_object('permissions', p_permissions));
end $$;

drop policy if exists board_role_permissions_staff_read on public.board_role_permissions;
create policy board_role_permissions_staff_read on public.board_role_permissions
  for select to authenticated using (public.can_manage_association(association_id));
drop policy if exists board_role_permissions_board_read on public.board_role_permissions;
create policy board_role_permissions_board_read on public.board_role_permissions
  for select to authenticated using (association_id in (select public.current_board_association_ids()));

-- ------------------------------------------------------------ read policies
-- Swap current_board_association_ids() for the permission-filtered set in the
-- board's own read policies. Owner/staff policies are separate, so a board
-- member who owns a unit still sees their own charges and payments.
do $$
declare
  t record;
  p record;
  v_new text;
begin
  for t in
    select * from (values
      ('journal_lines',            'journal_lines_board_read',            'view_financials'),
      ('bank_accounts',            'bank_accounts_board_read',            'view_financials'),
      ('payable_bills',            'payable_bills_board_read',            'view_financials'),
      ('year_end_packages',        'year_end_packages_board_read',        'view_financials'),
      ('reserve_studies',          'reserve_studies_read',                'view_financials'),
      ('reserve_components',       'reserve_components_read',             'view_financials'),
      ('reserve_funding_scenarios','reserve_scenarios_read',              'view_financials'),
      ('statements',               'statements_board_read',               'view_financials'),
      ('charges',                  'charges_board_read',                  'view_delinquency'),
      ('payments',                 'payments_board_read',                 'view_delinquency'),
      ('delinquency_cases',        'delinquency_cases_board_read',        'view_delinquency'),
      ('delinquency_case_events',  'delinquency_events_board_read',       'view_delinquency')
    ) as x(tbl, pol, perm)
  loop
    select * into p from pg_policies where schemaname = 'public' and tablename = t.tbl and policyname = t.pol;
    if p.qual is null or p.qual !~ 'current_board_association_ids\(\)' then
      raise exception 'board_officer_permissions: policy %.% drifted', t.tbl, t.pol;
    end if;
    v_new := replace(p.qual, 'current_board_association_ids()', format('current_board_association_ids_with(%L)', t.perm));
    execute format('alter policy %I on public.%I using (%s)', t.pol, t.tbl, v_new);
  end loop;
end $$;

alter policy journal_entries_board_read on public.journal_entries
  using (public.is_board_user() and public.journal_entry_touches_board_financials(id));

-- Budget-vs-actuals and the meeting financial snapshot both authorize through this.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.can_read_association_budget(uuid)'::regprocedure);
  if def !~ 'a\.id in \(select public\.current_board_association_ids\(\)\)' then
    raise exception 'board_officer_permissions: can_read_association_budget drifted';
  end if;
  def := regexp_replace(def, 'a\.id in \(select public\.current_board_association_ids\(\)\)',
                        'a.id in (select public.current_board_association_ids_with(''view_financials''))');
  execute def;
end $$;

-- ------------------------------------------------------------ comment policies
alter policy board_insert_comments on public.board_comments
  with check (author_id = (select auth.uid())
              and association_id in (select public.current_board_association_ids_with('comment_cases')));

do $$
declare
  t record;
  p record;
begin
  for t in
    select * from (values
      ('architectural_request_messages', 'arch_msg_board_insert'),
      ('work_order_messages',            'wo_msg_board_insert')
    ) as x(tbl, pol)
  loop
    select * into p from pg_policies where schemaname = 'public' and tablename = t.tbl and policyname = t.pol;
    if p.with_check is null or p.with_check !~ 'current_board_association_ids\(\)' then
      raise exception 'board_officer_permissions: policy %.% drifted', t.tbl, t.pol;
    end if;
    execute format('alter policy %I on public.%I with check (%s)', t.pol, t.tbl,
                   replace(p.with_check, 'current_board_association_ids()', 'current_board_association_ids_with(''comment_cases'')'));
  end loop;
end $$;

-- ------------------------------------------------------------ voting
-- Votes only through cast_board_approval (security definer).
drop policy if exists approval_decisions_board_insert on public.approval_decisions;
drop policy if exists approval_decisions_board_update on public.approval_decisions;
drop policy if exists approval_votes_board_cast on public.approval_votes;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.cast_board_approval(uuid, text, text, text)'::regprocedure);
  if def !~ 'if v_member_id is null then raise exception ''Not a board member for this request''; end if;'
     or def !~ 'v_eligible := cardinality\(r\.board_member_ids\);'
     or def !~ 'select count\(\*\) into v_eligible from public\.board_members\s+where association_id = r\.association_id and active;' then
    raise exception 'board_officer_permissions: cast_board_approval drifted';
  end if;
  -- The voter's seat must carry the vote permission.
  def := replace(def,
    'if v_member_id is null then raise exception ''Not a board member for this request''; end if;',
    'if v_member_id is null then raise exception ''Not a board member for this request''; end if;' || chr(10) ||
    '  if not public.board_member_can(v_member_id, ''vote_approvals'') then' || chr(10) ||
    '    raise exception ''Your board role is not permitted to vote on approvals for this association'' using errcode = ''42501'';' || chr(10) ||
    '  end if;');
  -- Only members allowed to vote count toward majority / unanimity / percentage.
  def := replace(def, 'v_eligible := cardinality(r.board_member_ids);',
    'select count(*) into v_eligible from unnest(r.board_member_ids) as m(id) where public.board_member_can(m.id, ''vote_approvals'');');
  def := regexp_replace(def,
    'select count\(\*\) into v_eligible from public\.board_members\s+where association_id = r\.association_id and active;',
    'select count(*) into v_eligible from public.board_members where association_id = r.association_id and active and public.board_member_can(id, ''vote_approvals'');');
  execute def;
end $$;

-- ------------------------------------------------------------ grants
do $$
begin
  revoke all on function public.current_board_association_ids_with(text) from public, anon;
  grant execute on function public.current_board_association_ids_with(text) to authenticated, service_role;
  revoke all on function public.board_member_can(uuid, text) from public, anon;
  grant execute on function public.board_member_can(uuid, text) to authenticated, service_role;
  revoke all on function public.journal_entry_touches_board_financials(uuid) from public, anon;
  grant execute on function public.journal_entry_touches_board_financials(uuid) to authenticated, service_role;
  revoke all on function public.my_board_permissions() from public, anon;
  grant execute on function public.my_board_permissions() to authenticated, service_role;
  revoke all on function public.set_board_role_permissions(uuid, jsonb) from public, anon;
  grant execute on function public.set_board_role_permissions(uuid, jsonb) to authenticated, service_role;
end $$;
