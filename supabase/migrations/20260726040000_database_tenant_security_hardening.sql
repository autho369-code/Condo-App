-- Tenant-security hardening for legacy SECURITY DEFINER RPCs and permissive RLS.
--
-- This migration is intentionally fail-closed.  In particular, inventory_items
-- has no tenant key in the live schema, so only platform operators retain direct
-- access until a separate, reviewed ownership backfill can assign every row.

-- ---------------------------------------------------------------------------
-- Budget authorization helpers and RPCs
-- ---------------------------------------------------------------------------

create or replace function public.can_read_association_budget(p_association_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.associations a
      where a.id = p_association_id
        and (
          public.is_platform_operator()
          or (
            (public.is_any_staff() or public.is_company_admin())
            and public.can_access_portfolio(a.portfolio_id)
          )
          or (
            public.is_board_user()
            and a.id in (select public.current_board_association_ids())
          )
        )
    );
$$;

create or replace function public.can_mutate_association_budget(p_association_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.associations a
      where a.id = p_association_id
        and (
          public.is_platform_operator()
          or public.can_manage_finance(a.portfolio_id)
        )
    );
$$;

revoke all on function public.can_read_association_budget(uuid) from public, anon;
revoke all on function public.can_mutate_association_budget(uuid) from public, anon;
grant execute on function public.can_read_association_budget(uuid) to authenticated;
grant execute on function public.can_mutate_association_budget(uuid) to authenticated;

create or replace function public.get_budget_vs_actuals(
  p_association_id uuid,
  p_fiscal_year integer
)
returns table (
  budget_line_id uuid,
  gl_account_id uuid,
  gl_account_number integer,
  gl_account_name text,
  category text,
  notes text,
  monthly_budget numeric[],
  monthly_actuals numeric[],
  monthly_variance numeric[],
  annual_budget numeric,
  annual_actual numeric,
  annual_variance numeric,
  annual_variance_pct numeric
)
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_month integer;
  v_budget_line record;
  v_actual numeric;
  v_actuals numeric[];
  v_variances numeric[];
  v_total_budget numeric;
  v_total_actual numeric;
  v_start date;
  v_end date;
begin
  if p_association_id is null
     or p_fiscal_year is null
     or p_fiscal_year not between 1900 and 2200 then
    raise exception 'Invalid budget scope' using errcode = '22023';
  end if;

  if not public.can_read_association_budget(p_association_id) then
    raise exception 'Not authorized for this association budget' using errcode = '42501';
  end if;

  for v_budget_line in
    select bl.*, ga.number as gl_number, ga.name as gl_name
    from public.budget_lines bl
    join public.gl_accounts ga on ga.id = bl.gl_account_id
    join public.associations a on a.id = bl.association_id
    where bl.association_id = p_association_id
      and bl.fiscal_year = p_fiscal_year
      and ga.portfolio_id = a.portfolio_id
      and (ga.association_id is null or ga.association_id = bl.association_id)
    order by ga.number
  loop
    v_actuals := array_fill(0::numeric, array[12]);

    for v_month in 1..12 loop
      v_start := pg_catalog.make_date(p_fiscal_year, v_month, 1);
      v_end := (v_start + interval '1 month')::date;

      if v_budget_line.category = 'expense' then
        select coalesce(sum(pb.amount), 0)
        into v_actual
        from public.payable_bills pb
        where pb.association_id = p_association_id
          and pb.gl_account_id = v_budget_line.gl_account_id
          and pb.occurred_on >= v_start
          and pb.occurred_on < v_end
          and pb.status in ('paid', 'approved');
      else
        select coalesce(sum(c.amount), 0)
        into v_actual
        from public.charges c
        join public.units u on u.id = c.unit_id
        join public.buildings b on b.id = u.building_id
        where b.association_id = p_association_id
          and c.gl_account_id = v_budget_line.gl_account_id
          and c.created_at::date >= v_start
          and c.created_at::date < v_end;
      end if;

      v_actuals[v_month] := v_actual;
    end loop;

    v_total_budget := 0;
    v_total_actual := 0;
    v_variances := array_fill(0::numeric, array[12]);
    for v_month in 1..12 loop
      v_total_budget := v_total_budget + coalesce(v_budget_line.monthly_amounts[v_month], 0);
      v_total_actual := v_total_actual + coalesce(v_actuals[v_month], 0);
      v_variances[v_month] := coalesce(v_actuals[v_month], 0)
        - coalesce(v_budget_line.monthly_amounts[v_month], 0);
    end loop;

    budget_line_id := v_budget_line.id;
    gl_account_id := v_budget_line.gl_account_id;
    gl_account_number := v_budget_line.gl_number;
    gl_account_name := v_budget_line.gl_name;
    category := v_budget_line.category::text;
    notes := v_budget_line.notes;
    monthly_budget := v_budget_line.monthly_amounts;
    monthly_actuals := v_actuals;
    monthly_variance := v_variances;
    annual_budget := v_total_budget;
    annual_actual := v_total_actual;
    annual_variance := v_total_actual - v_total_budget;
    annual_variance_pct := case
      when v_total_budget <> 0
        then round(((v_total_actual - v_total_budget) / v_total_budget * 100)::numeric, 1)
      else 0
    end;
    return next;
  end loop;
end;
$$;

create or replace function public.list_budget_lines(
  p_association_id uuid,
  p_fiscal_year integer default null
)
returns table (
  id uuid,
  association_id uuid,
  gl_account_id uuid,
  gl_account_number integer,
  gl_account_name text,
  fiscal_year integer,
  monthly_amounts numeric[],
  annual_total numeric,
  category text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
begin
  if p_association_id is null
     or (p_fiscal_year is not null and p_fiscal_year not between 1900 and 2200) then
    raise exception 'Invalid budget scope' using errcode = '22023';
  end if;

  if not public.can_read_association_budget(p_association_id) then
    raise exception 'Not authorized for this association budget' using errcode = '42501';
  end if;

  return query
  select bl.id,
         bl.association_id,
         bl.gl_account_id,
         ga.number,
         ga.name,
         bl.fiscal_year,
         bl.monthly_amounts,
         bl.annual_total,
         bl.category::text,
         bl.notes,
         bl.created_at,
         bl.updated_at
  from public.budget_lines bl
  join public.gl_accounts ga on ga.id = bl.gl_account_id
  join public.associations a on a.id = bl.association_id
  where bl.association_id = p_association_id
    and (p_fiscal_year is null or bl.fiscal_year = p_fiscal_year)
    and ga.portfolio_id = a.portfolio_id
    and (ga.association_id is null or ga.association_id = bl.association_id)
  order by bl.category, ga.number;
end;
$$;

create or replace function public.upsert_budget_line(
  p_id uuid,
  p_association_id uuid,
  p_gl_account_id uuid,
  p_fiscal_year integer,
  p_monthly_amounts numeric[],
  p_category text,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_id uuid;
  v_target_association_id uuid;
  v_target_portfolio_id uuid;
begin
  if p_id is not null then
    select bl.association_id
    into v_target_association_id
    from public.budget_lines bl
    where bl.id = p_id
    for update;

    if not found then
      raise exception 'Budget line not found' using errcode = 'P0002';
    end if;
    if p_association_id is distinct from v_target_association_id then
      raise exception 'Budget line association cannot be changed' using errcode = '22023';
    end if;
  else
    v_target_association_id := p_association_id;
  end if;

  if v_target_association_id is null
     or p_gl_account_id is null
     or p_fiscal_year is null
     or p_fiscal_year not between 1900 and 2200
     or p_monthly_amounts is null
     or cardinality(p_monthly_amounts) <> 12
     or p_category is null
     or p_category not in ('income', 'expense')
     or length(coalesce(p_notes, '')) > 10000
     or exists (
       select 1
       from unnest(p_monthly_amounts) as amount(value)
       where amount.value is null
          or amount.value::text = 'NaN'
          or amount.value < 0
          or amount.value > 1000000000000
     ) then
    raise exception 'Invalid budget line input' using errcode = '22023';
  end if;

  if not public.can_mutate_association_budget(v_target_association_id) then
    raise exception 'Finance authorization required' using errcode = '42501';
  end if;

  select a.portfolio_id
  into v_target_portfolio_id
  from public.associations a
  where a.id = v_target_association_id;

  if v_target_portfolio_id is null
     or not exists (
       select 1
       from public.gl_accounts ga
       where ga.id = p_gl_account_id
         and ga.portfolio_id = v_target_portfolio_id
         and (ga.association_id is null or ga.association_id = v_target_association_id)
     ) then
    raise exception 'GL account is outside the association scope' using errcode = '23514';
  end if;

  if p_id is not null then
    update public.budget_lines bl
    set gl_account_id = p_gl_account_id,
        fiscal_year = p_fiscal_year,
        monthly_amounts = p_monthly_amounts,
        category = p_category::public.budget_category,
        notes = nullif(trim(p_notes), ''),
        updated_at = pg_catalog.now()
    where bl.id = p_id
      and bl.association_id = v_target_association_id
    returning bl.id into v_id;
  else
    insert into public.budget_lines (
      association_id, gl_account_id, fiscal_year, monthly_amounts, category, notes
    ) values (
      v_target_association_id, p_gl_account_id, p_fiscal_year,
      p_monthly_amounts, p_category::public.budget_category, nullif(trim(p_notes), '')
    )
    returning budget_lines.id into v_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.delete_budget_line(p_id uuid)
returns void
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_target_association_id uuid;
begin
  if p_id is null then
    raise exception 'Budget line id is required' using errcode = '22023';
  end if;

  select bl.association_id
  into v_target_association_id
  from public.budget_lines bl
  where bl.id = p_id
  for update;

  if not found then
    raise exception 'Budget line not found' using errcode = 'P0002';
  end if;
  if not public.can_mutate_association_budget(v_target_association_id) then
    raise exception 'Finance authorization required' using errcode = '42501';
  end if;

  delete from public.budget_lines bl
  where bl.id = p_id
    and bl.association_id = v_target_association_id;
end;
$$;

revoke all on function public.get_budget_vs_actuals(uuid, integer) from public, anon;
revoke all on function public.list_budget_lines(uuid, integer) from public, anon;
revoke all on function public.upsert_budget_line(uuid, uuid, uuid, integer, numeric[], text, text) from public, anon;
revoke all on function public.delete_budget_line(uuid) from public, anon;
grant execute on function public.get_budget_vs_actuals(uuid, integer) to authenticated;
grant execute on function public.list_budget_lines(uuid, integer) to authenticated;
grant execute on function public.upsert_budget_line(uuid, uuid, uuid, integer, numeric[], text, text) to authenticated;
grant execute on function public.delete_budget_line(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Meeting attendance: authenticated, association-scoped, and bounded
-- ---------------------------------------------------------------------------

create or replace function public.validate_meeting_attendee_tenant_scope()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_association_id uuid;
begin
  select m.association_id
  into v_association_id
  from public.meetings m
  where m.id = new.meeting_id;

  if v_association_id is null then
    raise exception 'Meeting not found' using errcode = '23503';
  end if;
  if length(trim(new.attendee_name)) not between 1 and 200
     or length(coalesce(new.notes, '')) > 2000
     or octet_length(coalesce(new.signature_data, '')) > 1048576
     or new.attendee_role is null
     or new.attendee_role not in ('board_member', 'owner', 'manager', 'guest') then
    raise exception 'Invalid meeting attendance input' using errcode = '22023';
  end if;
  if new.owner_id is not null
     and not exists (
       select 1
       from public.occupancies o
       where o.owner_id = new.owner_id
         and o.association_id = v_association_id
     ) then
    raise exception 'Owner is outside the meeting association' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_meeting_attendee_tenant_scope on public.meeting_attendees;
create trigger trg_validate_meeting_attendee_tenant_scope
before insert or update
on public.meeting_attendees
for each row execute function public.validate_meeting_attendee_tenant_scope();

revoke all on function public.validate_meeting_attendee_tenant_scope() from public, anon, authenticated;
grant execute on function public.validate_meeting_attendee_tenant_scope() to service_role;

create or replace function public.calculate_meeting_quorum(p_meeting_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_meeting public.meetings%rowtype;
  v_quorum_pct integer;
  v_total_units integer;
  v_attendee_count integer;
  v_board_count integer;
  v_owner_count integer;
  v_quorum_needed integer;
  v_quorum_reached boolean;
  v_authorized boolean;
begin
  if auth.uid() is null or p_meeting_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_meeting
  from public.meetings m
  where m.id = p_meeting_id
  for update;

  if not found then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;

  v_authorized := public.is_platform_operator()
    or (
      (public.is_any_staff() or public.is_company_admin())
      and public.can_access_portfolio(v_meeting.portfolio_id)
    )
    or (
      public.is_board_user()
      and v_meeting.association_id in (select public.current_board_association_ids())
    )
    or (
      public.is_portal_resident()
      and v_meeting.association_id in (select public.current_resident_association_ids())
    );

  if not v_authorized then
    raise exception 'Not authorized for this meeting' using errcode = '42501';
  end if;

  select greatest(1, least(100, coalesce(a.quorum_percentage, 51))),
         greatest(0, coalesce(a.unit_count, 0))
  into v_quorum_pct, v_total_units
  from public.associations a
  where a.id = v_meeting.association_id;

  select count(*)::integer,
         count(*) filter (where ma.attendee_role = 'board_member')::integer,
         count(distinct ma.owner_id) filter (
           where ma.owner_id is not null
             and coalesce(ma.voting_eligible, false)
             and exists (
               select 1 from public.occupancies o
               where o.owner_id = ma.owner_id
                 and o.association_id = v_meeting.association_id
                 and o.status = 'current'
             )
         )::integer
  into v_attendee_count, v_board_count, v_owner_count
  from public.meeting_attendees ma
  where ma.meeting_id = p_meeting_id
    and ma.present;

  v_quorum_needed := ceil(v_total_units * v_quorum_pct / 100.0)::integer;
  v_quorum_reached := v_owner_count >= v_quorum_needed;

  update public.meetings m
  set quorum_met = v_quorum_reached,
      quorum_requirement = v_quorum_needed,
      total_units = v_total_units
  where m.id = p_meeting_id;

  return jsonb_build_object(
    'meeting_id', p_meeting_id,
    'total_units', v_total_units,
    'quorum_percentage', v_quorum_pct,
    'quorum_needed', v_quorum_needed,
    'attendee_count', v_attendee_count,
    'board_count', v_board_count,
    'owner_count', v_owner_count,
    'quorum_reached', v_quorum_reached
  );
end;
$$;

create or replace function public.record_meeting_attendance(
  p_meeting_id uuid,
  p_attendee_name text,
  p_owner_id uuid default null,
  p_attendee_role text default 'owner',
  p_signature_data text default null,
  p_voting_eligible boolean default true,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_meeting public.meetings%rowtype;
  v_attendee_id uuid;
  v_is_staff boolean;
  v_is_board boolean;
  v_is_resident boolean;
  v_current_owner_id uuid;
  v_effective_owner_id uuid;
  v_effective_name text;
  v_effective_role text;
  v_effective_voting boolean;
begin
  if auth.uid() is null or p_meeting_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if length(coalesce(p_attendee_name, '')) > 200
     or length(coalesce(p_notes, '')) > 2000
     or octet_length(coalesce(p_signature_data, '')) > 1048576
     or p_attendee_role is null
     or p_attendee_role not in ('board_member', 'owner', 'manager', 'guest') then
    raise exception 'Invalid meeting attendance input' using errcode = '22023';
  end if;

  select * into v_meeting
  from public.meetings m
  where m.id = p_meeting_id;
  if not found then
    raise exception 'Meeting not found' using errcode = 'P0002';
  end if;

  v_is_staff := public.is_platform_operator()
    or (
      (public.is_any_staff() or public.is_company_admin())
      and public.can_access_portfolio(v_meeting.portfolio_id)
    );
  v_is_board := public.is_board_user()
    and v_meeting.association_id in (select public.current_board_association_ids());
  v_is_resident := public.is_portal_resident()
    and v_meeting.association_id in (select public.current_resident_association_ids());

  if not (v_is_staff or v_is_board or v_is_resident) then
    raise exception 'Not authorized for this meeting' using errcode = '42501';
  end if;

  if v_is_staff then
    v_effective_owner_id := p_owner_id;
    v_effective_name := trim(p_attendee_name);
    v_effective_role := p_attendee_role;
    v_effective_voting := coalesce(p_voting_eligible, false);

    if length(v_effective_name) not between 1 and 200 then
      raise exception 'Attendee name is required' using errcode = '22023';
    end if;
    if v_effective_owner_id is not null
       and not exists (
         select 1
         from public.occupancies o
         where o.owner_id = v_effective_owner_id
           and o.association_id = v_meeting.association_id
           and o.status = 'current'
       ) then
      raise exception 'Owner is outside the meeting association' using errcode = '23514';
    end if;
  else
    v_current_owner_id := public.current_owner_id();

    if v_current_owner_id is not null
       and exists (
         select 1 from public.occupancies o
         where o.owner_id = v_current_owner_id
           and o.association_id = v_meeting.association_id
           and o.status = 'current'
       ) then
      if p_owner_id is not null and p_owner_id <> v_current_owner_id then
        raise exception 'Residents may only sign in themselves' using errcode = '42501';
      end if;
      select o.id, o.full_name
      into v_effective_owner_id, v_effective_name
      from public.owners o
      where o.id = v_current_owner_id;
      v_effective_role := case when v_is_board then 'board_member' else 'owner' end;
      v_effective_voting := true;
    elsif v_is_board then
      if p_owner_id is not null then
        raise exception 'Board user owner identity does not match' using errcode = '42501';
      end if;
      select coalesce(nullif(trim(p.full_name), ''), nullif(trim(p.email), ''), 'Board member')
      into v_effective_name
      from public.profiles p
      where p.id = auth.uid();
      v_effective_owner_id := null;
      v_effective_role := 'board_member';
      v_effective_voting := true;
    else
      raise exception 'Current owner record is required' using errcode = '42501';
    end if;
  end if;

  if v_effective_owner_id is not null then
    select ma.id into v_attendee_id
    from public.meeting_attendees ma
    where ma.meeting_id = p_meeting_id
      and ma.owner_id = v_effective_owner_id
    order by ma.created_at
    limit 1
    for update;
  end if;

  if v_attendee_id is not null then
    update public.meeting_attendees ma
    set signature_data = coalesce(p_signature_data, ma.signature_data),
        present = true,
        attendee_name = v_effective_name,
        attendee_role = v_effective_role,
        voting_eligible = v_effective_voting,
        notes = coalesce(nullif(trim(p_notes), ''), ma.notes),
        check_in_time = pg_catalog.now()
    where ma.id = v_attendee_id;
  else
    insert into public.meeting_attendees (
      meeting_id, owner_id, attendee_name, attendee_role,
      check_in_time, signature_data, present, voting_eligible, notes
    ) values (
      p_meeting_id, v_effective_owner_id, v_effective_name, v_effective_role,
      pg_catalog.now(), p_signature_data, true, v_effective_voting, nullif(trim(p_notes), '')
    )
    returning meeting_attendees.id into v_attendee_id;
  end if;

  perform public.calculate_meeting_quorum(p_meeting_id);
  return v_attendee_id;
end;
$$;

revoke all on function public.calculate_meeting_quorum(uuid) from public, anon;
revoke all on function public.record_meeting_attendance(uuid, text, uuid, text, text, boolean, text) from public, anon;
grant execute on function public.calculate_meeting_quorum(uuid) to authenticated;
grant execute on function public.record_meeting_attendance(uuid, text, uuid, text, text, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Trustworthy tenant and storage-path resolution helpers
-- ---------------------------------------------------------------------------

create or replace function public.document_portfolio_id(
  p_entity_type text,
  p_entity_id uuid,
  p_uploaded_by uuid
)
returns uuid
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select case lower(trim(p_entity_type))
    when 'association' then (
      select a.portfolio_id from public.associations a where a.id = p_entity_id
    )
    when 'owner' then (
      select o.portfolio_id from public.owners o where o.id = p_entity_id
    )
    when 'vendor' then (
      select v.portfolio_id from public.vendors v where v.id = p_entity_id
    )
    when 'unit' then (
      select a.portfolio_id
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id
      where u.id = p_entity_id
    )
    when 'general' then (
      select p.portfolio_id from public.profiles p where p.id = p_uploaded_by
    )
    else null
  end;
$$;

create or replace function public.document_path_matches_entity(
  p_entity_type text,
  p_entity_id uuid,
  p_file_url text
)
returns boolean
language sql
immutable
set search_path = 'pg_catalog', 'public'
as $$
  select p_entity_id is not null
    and p_file_url is not null
    and octet_length(p_file_url) <= 2048
    and position(chr(92) in p_file_url) = 0
    and p_file_url !~* '(^|/)(\.\.|%2e%2e)(/|$)'
    and p_file_url !~* '^[a-z][a-z0-9+.-]*://'
    and (
      p_file_url = ''
      or (lower(trim(p_entity_type)) = 'association'
          and p_file_url like 'associations/' || p_entity_id::text || '/%')
      or (lower(trim(p_entity_type)) = 'owner'
          and (
            p_file_url like 'insurance/' || p_entity_id::text || '/%'
            or p_file_url like 'owners/' || p_entity_id::text || '/%'
          ))
      or (lower(trim(p_entity_type)) = 'vendor'
          and p_file_url like 'vendors/' || p_entity_id::text || '/%')
      or (lower(trim(p_entity_type)) = 'unit'
          and p_file_url like 'units/' || p_entity_id::text || '/%')
    );
$$;

create or replace function public.insurance_policy_scope_valid(
  p_owner_id uuid,
  p_association_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select exists (
    select 1
    from public.owners o
    where o.id = p_owner_id
      and o.portfolio_id is not null
      and (
        p_association_id is null
        or exists (
          select 1
          from public.associations a
          where a.id = p_association_id
            and a.portfolio_id = o.portfolio_id
            and exists (
              select 1
              from public.occupancies oc
              where oc.owner_id = o.id
                and oc.association_id = a.id
            )
        )
      )
  );
$$;

create or replace function public.insurance_certificate_path_matches(
  p_owner_id uuid,
  p_path text
)
returns boolean
language sql
immutable
set search_path = 'pg_catalog', 'public'
as $$
  select p_path is null
    or p_path = ''
    or (
      p_owner_id is not null
      and octet_length(p_path) <= 2048
      and position(chr(92) in p_path) = 0
      and p_path !~* '(^|/)(\.\.|%2e%2e)(/|$)'
      and p_path !~* '^[a-z][a-z0-9+.-]*://'
      and p_path like 'insurance/' || p_owner_id::text || '/%'
    );
$$;

create or replace function public.maintenance_task_links_valid(
  p_association_id uuid,
  p_vendor_id uuid,
  p_assigned_staff_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select exists (
    select 1
    from public.associations a
    where a.id = p_association_id
      and a.portfolio_id is not null
      and (
        p_vendor_id is null
        or exists (
          select 1 from public.vendors v
          where v.id = p_vendor_id and v.portfolio_id = a.portfolio_id
        )
      )
      and (
        p_assigned_staff_id is null
        or exists (
          select 1 from public.profiles p
          where p.id = p_assigned_staff_id and p.portfolio_id = a.portfolio_id
        )
      )
  );
$$;

create or replace function public.maintenance_history_links_valid(
  p_task_id uuid,
  p_vendor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select exists (
    select 1
    from public.maintenance_tasks mt
    join public.associations a on a.id = mt.association_id
    where mt.id = p_task_id
      and (
        p_vendor_id is null
        or exists (
          select 1 from public.vendors v
          where v.id = p_vendor_id and v.portfolio_id = a.portfolio_id
        )
      )
  );
$$;

create or replace function public.violation_case_links_valid(
  p_association_id uuid,
  p_house_rule_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public'
as $$
  select exists (
    select 1
    from public.associations a
    where a.id = p_association_id
      and (
        p_house_rule_id is null
        or exists (
          select 1 from public.house_rules hr
          where hr.id = p_house_rule_id
            and hr.association_id = a.id
        )
      )
  );
$$;

revoke all on function public.document_portfolio_id(text, uuid, uuid) from public, anon;
revoke all on function public.document_path_matches_entity(text, uuid, text) from public, anon;
revoke all on function public.insurance_policy_scope_valid(uuid, uuid) from public, anon;
revoke all on function public.insurance_certificate_path_matches(uuid, text) from public, anon;
revoke all on function public.maintenance_task_links_valid(uuid, uuid, uuid) from public, anon;
revoke all on function public.maintenance_history_links_valid(uuid, uuid) from public, anon;
revoke all on function public.violation_case_links_valid(uuid, uuid) from public, anon;
grant execute on function public.document_portfolio_id(text, uuid, uuid) to authenticated;
grant execute on function public.document_path_matches_entity(text, uuid, text) to authenticated;
grant execute on function public.insurance_policy_scope_valid(uuid, uuid) to authenticated;
grant execute on function public.insurance_certificate_path_matches(uuid, text) to authenticated;
grant execute on function public.maintenance_task_links_valid(uuid, uuid, uuid) to authenticated;
grant execute on function public.maintenance_history_links_valid(uuid, uuid) to authenticated;
grant execute on function public.violation_case_links_valid(uuid, uuid) to authenticated;

alter table public.documents alter column uploaded_by set default auth.uid();

-- Remove every permissive legacy policy on the audited tables before rebuilding
-- the complete intended policy set below.  Supabase migrations run atomically,
-- so a failure while rebuilding rolls the drops back.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select p.tablename, p.policyname
    from pg_catalog.pg_policies p
    where p.schemaname = 'public'
      and p.tablename = any (array[
        'budget_lines', 'documents', 'insurance_policies', 'house_rules',
        'inventory_items', 'maintenance_tasks', 'maintenance_task_history',
        'violation_cases'
      ])
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      v_policy.policyname,
      v_policy.tablename
    );
  end loop;
end;
$$;

alter table public.budget_lines enable row level security;
create policy budget_lines_scoped_read on public.budget_lines
  for select to authenticated
  using (public.can_read_association_budget(association_id));
create policy budget_lines_finance_insert on public.budget_lines
  for insert to authenticated
  with check (public.can_mutate_association_budget(association_id));
create policy budget_lines_finance_update on public.budget_lines
  for update to authenticated
  using (public.can_mutate_association_budget(association_id))
  with check (public.can_mutate_association_budget(association_id));
create policy budget_lines_finance_delete on public.budget_lines
  for delete to authenticated
  using (public.can_mutate_association_budget(association_id));

alter table public.documents enable row level security;
create policy documents_staff_tenant_all on public.documents
  for all to authenticated
  using (
    auth.uid() is not null
    and (public.is_any_staff() or public.is_company_admin())
    and public.document_path_matches_entity(entity_type, entity_id, file_url)
    and public.can_access_portfolio(
      public.document_portfolio_id(entity_type, entity_id, coalesce(uploaded_by, auth.uid()))
    )
  )
  with check (
    auth.uid() is not null
    and (public.is_any_staff() or public.is_company_admin())
    and (uploaded_by is null or uploaded_by = auth.uid())
    and public.document_path_matches_entity(entity_type, entity_id, file_url)
    and public.can_access_portfolio(
      public.document_portfolio_id(entity_type, entity_id, coalesce(uploaded_by, auth.uid()))
    )
  );
create policy documents_platform_select on public.documents
  for select to authenticated
  using (auth.uid() is not null and public.is_platform_operator());
create policy documents_platform_insert on public.documents
  for insert to authenticated
  with check (
    auth.uid() is not null
    and public.is_platform_operator()
    and public.document_portfolio_id(entity_type, entity_id, coalesce(uploaded_by, auth.uid())) is not null
    and public.document_path_matches_entity(entity_type, entity_id, file_url)
  );
create policy documents_platform_update on public.documents
  for update to authenticated
  using (auth.uid() is not null and public.is_platform_operator())
  with check (
    auth.uid() is not null
    and public.is_platform_operator()
    and public.document_portfolio_id(entity_type, entity_id, coalesce(uploaded_by, auth.uid())) is not null
    and public.document_path_matches_entity(entity_type, entity_id, file_url)
  );
create policy documents_platform_delete on public.documents
  for delete to authenticated
  using (auth.uid() is not null and public.is_platform_operator());
create policy documents_board_association_read on public.documents
  for select to authenticated
  using (
    auth.uid() is not null
    and public.is_board_user()
    and entity_type = 'association'
    and entity_id in (select public.current_board_association_ids())
    and public.document_path_matches_entity(entity_type, entity_id, file_url)
  );
create policy documents_resident_tenant_read on public.documents
  for select to authenticated
  using (
    auth.uid() is not null
    and public.is_portal_resident()
    and public.document_path_matches_entity(entity_type, entity_id, file_url)
    and (
      (entity_type = 'owner' and entity_id = public.current_owner_id())
      or (
        entity_type = 'association'
        and entity_id in (select public.current_resident_association_ids())
      )
      or (
        entity_type = 'unit'
        and exists (
          select 1 from public.occupancies oc
          where oc.unit_id = documents.entity_id
            and oc.owner_id = public.current_owner_id()
            and oc.status = 'current'
        )
      )
    )
  );
create policy documents_vendor_own_read on public.documents
  for select to authenticated
  using (
    auth.uid() is not null
    and public.current_vendor_id() is not null
    and entity_type = 'vendor'
    and entity_id = public.current_vendor_id()
    and public.document_path_matches_entity(entity_type, entity_id, file_url)
  );

alter table public.insurance_policies enable row level security;
create policy insurance_staff_tenant_all on public.insurance_policies
  for all to authenticated
  using (
    auth.uid() is not null
    and (public.is_any_staff() or public.is_company_admin())
    and public.insurance_policy_scope_valid(owner_id, association_id)
    and public.insurance_certificate_path_matches(owner_id, certificate_file_url)
    and exists (
      select 1 from public.owners o
      where o.id = insurance_policies.owner_id
        and public.can_access_portfolio(o.portfolio_id)
    )
  )
  with check (
    auth.uid() is not null
    and (public.is_any_staff() or public.is_company_admin())
    and public.insurance_policy_scope_valid(owner_id, association_id)
    and public.insurance_certificate_path_matches(owner_id, certificate_file_url)
    and exists (
      select 1 from public.owners o
      where o.id = insurance_policies.owner_id
        and public.can_access_portfolio(o.portfolio_id)
    )
  );
create policy insurance_platform_all on public.insurance_policies
  for all to authenticated
  using (auth.uid() is not null and public.is_platform_operator())
  with check (
    auth.uid() is not null
    and public.is_platform_operator()
    and public.insurance_policy_scope_valid(owner_id, association_id)
    and public.insurance_certificate_path_matches(owner_id, certificate_file_url)
  );
create policy insurance_owner_read on public.insurance_policies
  for select to authenticated
  using (
    auth.uid() is not null
    and public.is_portal_resident()
    and owner_id = public.current_owner_id()
    and public.insurance_certificate_path_matches(owner_id, certificate_file_url)
  );
create policy insurance_owner_insert on public.insurance_policies
  for insert to authenticated
  with check (
    auth.uid() is not null
    and public.is_portal_resident()
    and owner_id = public.current_owner_id()
    and association_id in (select public.current_resident_association_ids())
    and exists (
      select 1 from public.occupancies oc
      where oc.owner_id = insurance_policies.owner_id
        and oc.association_id = insurance_policies.association_id
        and oc.status = 'current'
    )
    and public.insurance_certificate_path_matches(owner_id, certificate_file_url)
  );
create policy insurance_owner_update on public.insurance_policies
  for update to authenticated
  using (
    auth.uid() is not null
    and public.is_portal_resident()
    and owner_id = public.current_owner_id()
  )
  with check (
    auth.uid() is not null
    and public.is_portal_resident()
    and owner_id = public.current_owner_id()
    and association_id in (select public.current_resident_association_ids())
    and exists (
      select 1 from public.occupancies oc
      where oc.owner_id = insurance_policies.owner_id
        and oc.association_id = insurance_policies.association_id
        and oc.status = 'current'
    )
    and public.insurance_certificate_path_matches(owner_id, certificate_file_url)
  );
create policy insurance_board_association_read on public.insurance_policies
  for select to authenticated
  using (
    auth.uid() is not null
    and public.is_board_user()
    and association_id in (select public.current_board_association_ids())
    and public.insurance_policy_scope_valid(owner_id, association_id)
    and public.insurance_certificate_path_matches(owner_id, certificate_file_url)
  );

alter table public.house_rules enable row level security;
create policy house_rules_staff_tenant_all on public.house_rules
  for all to authenticated
  using (
    auth.uid() is not null
    and (public.is_any_staff() or public.is_company_admin())
    and public.can_access_association(association_id)
  )
  with check (
    auth.uid() is not null
    and (public.is_any_staff() or public.is_company_admin())
    and public.can_access_association(association_id)
  );
create policy house_rules_platform_all on public.house_rules
  for all to authenticated
  using (auth.uid() is not null and public.is_platform_operator())
  with check (auth.uid() is not null and public.is_platform_operator());
create policy house_rules_board_read on public.house_rules
  for select to authenticated
  using (
    auth.uid() is not null
    and public.is_board_user()
    and association_id in (select public.current_board_association_ids())
  );
create policy house_rules_resident_read on public.house_rules
  for select to authenticated
  using (
    auth.uid() is not null
    and public.is_portal_resident()
    and association_id in (select public.current_resident_association_ids())
  );

alter table public.inventory_items enable row level security;
create policy inventory_platform_only on public.inventory_items
  for all to authenticated
  using (auth.uid() is not null and public.is_platform_operator())
  with check (auth.uid() is not null and public.is_platform_operator());

alter table public.maintenance_tasks enable row level security;
create policy maintenance_tasks_staff_tenant_all on public.maintenance_tasks
  for all to authenticated
  using (
    auth.uid() is not null
    and (public.is_any_staff() or public.is_company_admin())
    and public.can_access_association(association_id)
    and public.maintenance_task_links_valid(association_id, vendor_id, assigned_staff_id)
  )
  with check (
    auth.uid() is not null
    and (public.is_any_staff() or public.is_company_admin())
    and public.can_access_association(association_id)
    and public.maintenance_task_links_valid(association_id, vendor_id, assigned_staff_id)
  );
create policy maintenance_tasks_platform_all on public.maintenance_tasks
  for all to authenticated
  using (auth.uid() is not null and public.is_platform_operator())
  with check (
    auth.uid() is not null
    and public.is_platform_operator()
    and public.maintenance_task_links_valid(association_id, vendor_id, assigned_staff_id)
  );
create policy maintenance_tasks_board_read on public.maintenance_tasks
  for select to authenticated
  using (
    auth.uid() is not null
    and public.is_board_user()
    and association_id in (select public.current_board_association_ids())
    and public.maintenance_task_links_valid(association_id, vendor_id, assigned_staff_id)
  );
create policy maintenance_tasks_resident_read on public.maintenance_tasks
  for select to authenticated
  using (
    auth.uid() is not null
    and public.is_portal_resident()
    and association_id in (select public.current_resident_association_ids())
    and public.maintenance_task_links_valid(association_id, vendor_id, assigned_staff_id)
  );
create policy maintenance_tasks_vendor_read on public.maintenance_tasks
  for select to authenticated
  using (
    auth.uid() is not null
    and vendor_id = public.current_vendor_id()
    and public.maintenance_task_links_valid(association_id, vendor_id, assigned_staff_id)
  );

alter table public.maintenance_task_history enable row level security;
create policy maintenance_history_staff_tenant_all on public.maintenance_task_history
  for all to authenticated
  using (
    auth.uid() is not null
    and (public.is_any_staff() or public.is_company_admin())
    and public.maintenance_history_links_valid(task_id, vendor_id)
    and exists (
      select 1 from public.maintenance_tasks mt
      where mt.id = maintenance_task_history.task_id
        and public.can_access_association(mt.association_id)
    )
  )
  with check (
    auth.uid() is not null
    and (public.is_any_staff() or public.is_company_admin())
    and (completed_by is null or completed_by = auth.uid())
    and public.maintenance_history_links_valid(task_id, vendor_id)
    and exists (
      select 1 from public.maintenance_tasks mt
      where mt.id = maintenance_task_history.task_id
        and public.can_access_association(mt.association_id)
    )
  );
create policy maintenance_history_platform_all on public.maintenance_task_history
  for all to authenticated
  using (auth.uid() is not null and public.is_platform_operator())
  with check (
    auth.uid() is not null
    and public.is_platform_operator()
    and public.maintenance_history_links_valid(task_id, vendor_id)
  );

alter table public.violation_cases enable row level security;
create policy violation_cases_staff_tenant_all on public.violation_cases
  for all to authenticated
  using (
    auth.uid() is not null
    and (public.is_any_staff() or public.is_company_admin())
    and public.can_access_association(association_id)
    and public.violation_case_links_valid(association_id, house_rule_id)
  )
  with check (
    auth.uid() is not null
    and (public.is_any_staff() or public.is_company_admin())
    and public.can_access_association(association_id)
    and public.violation_case_links_valid(association_id, house_rule_id)
  );
create policy violation_cases_platform_all on public.violation_cases
  for all to authenticated
  using (auth.uid() is not null and public.is_platform_operator())
  with check (
    auth.uid() is not null
    and public.is_platform_operator()
    and public.violation_case_links_valid(association_id, house_rule_id)
  );

-- ---------------------------------------------------------------------------
-- Internal-only mutators
-- ---------------------------------------------------------------------------

revoke all on function public.apply_payment(uuid, text, uuid[]) from public, anon, authenticated;
grant execute on function public.apply_payment(uuid, text, uuid[]) to service_role;

create or replace function public.check_insurance_expirations()
returns void
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
begin
  update public.insurance_policies
  set status = 'expiring_soon', updated_at = pg_catalog.now()
  where status = 'active'
    and expiration_date <= (current_date + interval '30 days')
    and expiration_date > current_date;

  update public.insurance_policies
  set status = 'expired', updated_at = pg_catalog.now()
  where status in ('active', 'expiring_soon')
    and expiration_date < current_date;
end;
$$;

revoke all on function public.check_insurance_expirations() from public, anon, authenticated;
grant execute on function public.check_insurance_expirations() to service_role;
