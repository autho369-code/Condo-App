-- One vendor login across a vendor's associations.
--
-- Since 20261009020000 each vendor record belongs to one association, so a
-- contractor working for several associations of a company has one record in
-- each. vendors.auth_user_id stays unique (one login per record), so until now
-- a portal login reached only one of those records.
--
-- Decision (Mirsad, 2026-10-09): staff invite per record. A login reaches the
-- record it was first linked to (vendors.auth_user_id) plus every record whose
-- invitation it accepted afterwards (vendor_portal_logins). Nothing is added
-- because an email matches: the old email fallback of current_vendor_id() is
-- removed, so a mistyped email on a record can never expose an association.
--
-- Records stay separate: every work order, bill, compliance item and rating
-- stays on its own record and association. The portal shows the union of the
-- login's records; each write targets one exact record of that union.
--
-- 1. vendor_portal_logins (vendor_id -> auth_user_id): the records added to a
--    login by accepting their invitations. RLS on; written only by the
--    invitation trigger (SECURITY DEFINER).
-- 2. current_vendor_ids(): every active record of the signed-in vendor login.
--    current_vendor_id() is its first (the linked record), for callers that
--    need one.
-- 3. Every policy that compared a row with current_vendor_id() now accepts
--    any of current_vendor_ids() (ALTER POLICY, no drop).
-- 4. submit_vendor_invoice bills the work order's own vendor record;
--    my_vendor_ratings and current_vendor_bill_association_ids cover every
--    record; me() returns vendor_ids.
-- 5. Accepting an invitation for another record while already signed up adds
--    that record to the login.
--
-- Additive: nothing is dropped or deleted.

-- 1) Records added to a login -------------------------------------------------

create table if not exists public.vendor_portal_logins (
  vendor_id uuid primary key references public.vendors(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  invitation_id uuid references public.user_invitations(id) on delete set null,
  linked_at timestamptz not null default now()
);

create index if not exists idx_vendor_portal_logins_auth_user on public.vendor_portal_logins(auth_user_id);
create index if not exists idx_vendor_portal_logins_portfolio on public.vendor_portal_logins(portfolio_id);
create index if not exists idx_vendor_portal_logins_invitation on public.vendor_portal_logins(invitation_id);

comment on table public.vendor_portal_logins is
  'Vendor records added to a portal login by accepting their invitations (one login across a vendor''s associations). The first record stays on vendors.auth_user_id.';

alter table public.vendor_portal_logins enable row level security;
revoke all on public.vendor_portal_logins from public, anon, authenticated;
grant select on public.vendor_portal_logins to authenticated;
grant all on public.vendor_portal_logins to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vendor_portal_logins'
                  and policyname = 'vendor_portal_logins_self_read') then
    create policy vendor_portal_logins_self_read on public.vendor_portal_logins for select to authenticated
      using (auth_user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vendor_portal_logins'
                  and policyname = 'vendor_portal_logins_staff_read') then
    -- Staff of the vendor record's own company and association.
    create policy vendor_portal_logins_staff_read on public.vendor_portal_logins for select to authenticated
      using (exists (select 1 from public.vendors ven
                      where ven.id = vendor_portal_logins.vendor_id
                        and public.can_access_portfolio(ven.portfolio_id)
                        and public.can_view_association_row(ven.association_id)));
  end if;
end $$;

-- 2) The signed-in vendor login's records -----------------------------------

-- Every active record of the login, the linked record (vendors.auth_user_id)
-- first. Only records of the login's own company, portal-activated and not
-- archived. PL/pgSQL SECURITY DEFINER like the other identity helpers
-- (20261008060000).
create or replace function public.current_vendor_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  if not public.is_current_identity_enabled() then
    return;
  end if;
  return query
  select v.id
    from public.vendors v
    join public.profiles p on p.id = auth.uid() and p.disabled_at is null and p.hoa_role = 'vendor'
   where v.portfolio_id = p.portfolio_id
     and v.portal_activated
     and v.archived_at is null
     and (v.auth_user_id = auth.uid()
          or exists (select 1 from public.vendor_portal_logins l
                      where l.vendor_id = v.id and l.auth_user_id = auth.uid()))
   order by (v.auth_user_id is not distinct from auth.uid()) desc, v.created_at, v.id;
end
$function$;

revoke all on function public.current_vendor_ids() from public, anon;
grant execute on function public.current_vendor_ids() to authenticated, service_role;

-- The first of them (the linked record). No email fallback any more: a record
-- reaches a login only through its own invitation.
create or replace function public.current_vendor_id()
returns uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return (select x from public.current_vendor_ids() x limit 1);
end
$function$;

revoke all on function public.current_vendor_id() from public, anon;
grant execute on function public.current_vendor_id() to authenticated, service_role;

comment on function public.current_vendor_id() is
  'The signed-in vendor login''s first record (the one linked through vendors.auth_user_id). Use current_vendor_ids() for every record of the login.';

-- 3) Policies accept any of the login's records ------------------------------

-- The function name may be printed with or without its schema, depending on
-- the search_path of the session; both forms are rewritten. Policies that only
-- check "current_vendor_id() IS NOT NULL" stay as they are (any record).
do $$
declare
  r record;
  v_sql text;
  v_pattern constant text := '= (public\.)?current_vendor_id\(\)';
  v_count int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where coalesce(qual, '') ~ v_pattern or coalesce(with_check, '') ~ v_pattern
  loop
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if r.qual is not null then
      v_sql := v_sql || format(' using (%s)',
        regexp_replace(r.qual, v_pattern, 'IN ( SELECT public.current_vendor_ids())', 'g'));
    end if;
    if r.with_check is not null then
      v_sql := v_sql || format(' with check (%s)',
        regexp_replace(r.with_check, v_pattern, 'IN ( SELECT public.current_vendor_ids())', 'g'));
    end if;
    execute v_sql;
    v_count := v_count + 1;
  end loop;

  if exists (select 1 from pg_policies
              where coalesce(qual, '') ~ v_pattern or coalesce(with_check, '') ~ v_pattern) then
    raise exception 'A policy still compares with current_vendor_id(). Check it, then run this migration again.';
  end if;
  raise notice 'Vendor policies now covering every record of a login: %', v_count;
end $$;

-- 4) Functions that resolved one vendor record --------------------------------

create or replace function public.current_vendor_bill_association_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return query
  select distinct pb.association_id
  from public.payable_bills pb
  where pb.vendor_id in (select public.current_vendor_ids())
    and pb.association_id is not null;
end
$function$;

create or replace function public.my_vendor_ratings(p_limit integer default 50)
returns table(work_order_id uuid, work_order_title text, rater_role text, score smallint, quality smallint, timeliness smallint,
              communication smallint, would_hire_again boolean, comment text, created_at timestamp with time zone)
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select r.work_order_id, wo.title, r.rater_role, r.score, r.quality, r.timeliness, r.communication,
         r.would_hire_again, r.comment, r.created_at
    from public.work_order_ratings r
    join public.work_orders wo on wo.id = r.work_order_id
   where r.vendor_id in (select public.current_vendor_ids())
   order by r.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$function$;

-- The invoice goes on the work order's own vendor record (one of the login's
-- records), with the attachment stored under that record.
create or replace function public.submit_vendor_invoice(p_work_order_id uuid, p_bill_number text, p_bill_date date, p_due_date date,
                                                        p_amount numeric, p_memo text, p_attachment_path text, p_file_name text)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_vendor_id uuid;
  v_portfolio_id uuid;
  v_association_id uuid;
  v_bill_id uuid := gen_random_uuid();
  v_bill_number text := trim(p_bill_number);
  v_file_name text := trim(p_file_name);
  v_status text;
  v_po_id uuid;
  v_po_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (select 1 from public.current_vendor_ids()) then
    raise exception 'Active vendor portal access is required';
  end if;

  select wo.vendor_id, wo.portfolio_id, wo.association_id, wo.status::text
    into v_vendor_id, v_portfolio_id, v_association_id, v_status
  from public.work_orders wo
  where wo.id = p_work_order_id
    and wo.vendor_id in (select public.current_vendor_ids())
    and wo.archived_at is null;

  if v_vendor_id is null or v_portfolio_id is null or v_association_id is null then
    raise exception 'Assigned work order not found';
  end if;
  if v_status not in ('done', 'completed', 'billed', 'closed') then
    raise exception 'Mark the job done before sending an invoice';
  end if;
  select count(*), min(po.id::text)::uuid into v_po_count, v_po_id
    from public.purchase_orders po
   where po.work_order_id = p_work_order_id
     and po.vendor_id = v_vendor_id
     and po.approval_status = 'approved'
     and po.cancelled_at is null
     and po.archived_at is null;
  if v_po_count > 1 then
    raise exception 'This job has more than one approved purchase order. Ask management which one applies before sending the invoice';
  elsif v_po_count = 0 then
    v_po_id := null;
  end if;
  if v_bill_number = '' or char_length(v_bill_number) > 100 then
    raise exception 'Invoice number must be 1 to 100 characters';
  end if;
  if p_amount is null or p_amount <= 0 or scale(p_amount) > 2 then
    raise exception 'Invoice amount must be positive with no more than two decimal places';
  end if;
  if p_bill_date is null then
    raise exception 'Invoice date is required';
  end if;
  if p_due_date is not null and p_due_date < p_bill_date then
    raise exception 'Due date cannot be before invoice date';
  end if;
  if p_memo is not null and char_length(p_memo) > 1000 then
    raise exception 'Memo must be 1,000 characters or fewer';
  end if;
  if v_file_name = '' or char_length(v_file_name) > 255 then
    raise exception 'Invoice file name is invalid';
  end if;
  if p_attachment_path not like 'vendors/' || v_vendor_id::text || '/invoice/%'
     or not public.document_path_matches_entity('vendor', v_vendor_id, p_attachment_path) then
    raise exception 'Invalid invoice attachment reference';
  end if;

  -- Serialize a vendor/invoice-number pair so rapid retries cannot create two
  -- accounting records even without a broad index over historical data.
  perform pg_advisory_xact_lock(hashtextextended(v_vendor_id::text || ':' || lower(v_bill_number), 0));
  if exists (
    select 1 from public.payable_bills pb
    where pb.vendor_id = v_vendor_id
      and pb.archived_at is null
      and lower(trim(pb.bill_number)) = lower(v_bill_number)
  ) then
    raise exception 'Invoice number already exists for this vendor';
  end if;

  insert into public.payable_bills (
    id, portfolio_id, vendor_id, association_id, work_order_id, purchase_order_id,
    bill_number, bill_date, due_date, occurred_on, amount, memo,
    status, approval_required, created_by
  ) values (
    v_bill_id, v_portfolio_id, v_vendor_id, v_association_id, p_work_order_id, v_po_id,
    v_bill_number, p_bill_date, p_due_date, p_bill_date, p_amount, nullif(trim(p_memo), ''),
    'pending_approval', true, auth.uid()
  );

  insert into public.documents (
    entity_type, entity_id, doc_type, file_name, file_url, uploaded_by
  ) values (
    'vendor', v_vendor_id, 'vendor_invoice', v_file_name, p_attachment_path, auth.uid()
  );

  return v_bill_id;
end;
$function$;

-- me() also returns every record of a vendor login.
create or replace function public.me()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
begin
  return (select s.x from (
  select jsonb_build_object(
    'auth_user_id', auth.uid(),
    'email', (select email from auth.users where id = auth.uid()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'portfolio', (
      select case
        when public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()
          then to_jsonb(po) - 'ai_api_key' - 'ai_api_key_ciphertext' - 'ai_endpoint'
        else jsonb_build_object(
          'id', po.id, 'company_name', po.company_name, 'slug', po.slug,
          'logo_url', po.logo_url, 'favicon_url', po.favicon_url, 'brand_color', po.brand_color,
          'brand_email', po.brand_email, 'website', po.website, 'public_website', po.public_website,
          'phone_number', po.phone_number, 'texting_phone_number', po.texting_phone_number,
          'support_email', po.support_email, 'support_phone', po.support_phone,
          'address_street', po.address_street, 'address_city', po.address_city,
          'address_state', po.address_state, 'address_zip', po.address_zip,
          'archived_at', po.archived_at, 'suspended_at', po.suspended_at)
      end
      from public.portfolios po
      where po.id = public.current_portfolio_id()
    ),
    'role_name', public.current_role_name(),
    'is_platform_operator', public.is_platform_operator(), 'platform_operator_role', (select po.role from public.platform_operators po where po.auth_user_id = auth.uid() and po.active limit 1),
    'is_company_admin', public.is_company_admin(),
    'is_full_access_staff', public.is_full_access_staff(),
    'is_finance_staff', public.is_finance_staff(),
    'is_staff', public.is_staff(),
    'is_board', public.is_board_user(),
    'is_resident', public.is_portal_resident(),
    'is_tenant', public.is_tenant_user(),
    'owner_id', public.current_owner_id(),
    'tenant_id', public.current_tenant_id(),
    'vendor_id', public.current_vendor_id(),
    'vendor_ids', array(select public.current_vendor_ids()),
    'board_association_ids', array(select public.current_board_association_ids()),
    'resident_association_ids', array(select public.current_resident_association_ids()),
    'resident_unit_ids', array(select public.current_resident_unit_ids()),
    'tenant_association_ids', array(select public.current_tenant_association_ids()),
    'tenant_unit_ids', array(select public.current_tenant_unit_ids())
  )
  ) s(x) limit 1);
end
$function$;

-- 5) Accepting another record's invitation adds it to the login --------------

-- A login's first record is linked through vendors.auth_user_id (unique). When
-- the same login accepts an invitation for another exact record (the record
-- named in metadata.vendor_id, in the same company, carrying the invited
-- email, not linked to another login), that record is added to the login and
-- activated. Invitations without a record keep the old behaviour.
create or replace function public.link_vendor_on_invitation_accept()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.hoa_role::text = 'vendor'
     and new.status::text = 'accepted' and old.status::text is distinct from 'accepted'
     and new.used_by is not null
     and not exists (select 1 from public.vendors x where x.auth_user_id = new.used_by) then
    update public.vendors v
       set auth_user_id = new.used_by, portal_activated = true
     where v.id = (
       select c.id from public.vendors c
        where c.portfolio_id = new.portfolio_id
          and c.auth_user_id is null
          and c.archived_at is null
          -- Never a record already added to another login.
          and not exists (select 1 from public.vendor_portal_logins l where l.vendor_id = c.id)
          -- An invitation for one exact vendor record links that record or
          -- nothing (never another association's record with the same email);
          -- older invitations without one fall back to association, then email.
          and (nullif(new.metadata ->> 'vendor_id', '') is null
               or c.id::text = new.metadata ->> 'vendor_id')
          and jsonb_typeof(c.emails) = 'array'
          and exists (
            select 1 from jsonb_array_elements(c.emails) as e(val)
             where lower(btrim(case jsonb_typeof(e.val)
                                 when 'string' then e.val #>> '{}'
                                 when 'object' then e.val ->> 'email'
                               end)) = lower(btrim(new.email)))
        order by (c.id::text = coalesce(new.metadata ->> 'vendor_id', '')) desc,
                 (c.association_id is not distinct from new.association_id and new.association_id is not null) desc,
                 c.created_at desc, c.id
        limit 1);
  elsif new.hoa_role::text = 'vendor'
     and new.status::text = 'accepted' and old.status::text is distinct from 'accepted'
     and new.used_by is not null
     and nullif(new.metadata ->> 'vendor_id', '') is not null
     and exists (select 1 from public.profiles p
                  where p.id = new.used_by and p.portfolio_id = new.portfolio_id
                    and p.hoa_role = 'vendor' and p.disabled_at is null) then
    -- The login already has a vendor record: add the invited record to it.
    insert into public.vendor_portal_logins (vendor_id, auth_user_id, portfolio_id, invitation_id)
    select c.id, new.used_by, c.portfolio_id, new.id
      from public.vendors c
     where c.id::text = new.metadata ->> 'vendor_id'
       and c.portfolio_id = new.portfolio_id
       and c.archived_at is null
       and c.auth_user_id is null
       and jsonb_typeof(c.emails) = 'array'
       and exists (
         select 1 from jsonb_array_elements(c.emails) as e(val)
          where lower(btrim(case jsonb_typeof(e.val)
                              when 'string' then e.val #>> '{}'
                              when 'object' then e.val ->> 'email'
                            end)) = lower(btrim(new.email)))
    on conflict (vendor_id) do nothing;

    -- Activate it for this login (also a record of this login that staff had
    -- turned off and invited again).
    update public.vendors v
       set portal_activated = true
     where v.id::text = new.metadata ->> 'vendor_id'
       and not v.portal_activated
       and v.archived_at is null
       and (v.auth_user_id = new.used_by
            or exists (select 1 from public.vendor_portal_logins l
                        where l.vendor_id = v.id and l.auth_user_id = new.used_by));
  end if;
  return new;
end
$function$;

revoke all on function public.link_vendor_on_invitation_accept() from public, anon, authenticated;

-- 6) A record already added to a login is never another login's first record -

-- Sign-up auto-link and the bulk relink (as in 20261009020000) skip records
-- that vendor_portal_logins already gives to a login.
create or replace function public.auto_link_portal_user()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_portfolio_id uuid;
begin
  select p.portfolio_id into v_portfolio_id
  from public.profiles p
  where p.id = new.id and p.disabled_at is null;

  if v_portfolio_id is null then
    return new;
  end if;

  -- One homeowner record per sign-in (owners.auth_user_id is unique). With one
  -- record per association, the same email can now be on several records:
  -- link the oldest instead of failing the whole sign-up on the second.
  update public.owners o
     set auth_user_id = new.id, portal_activated = true
   where o.id = (
     select candidate.id
       from public.owners candidate
      where candidate.portfolio_id = v_portfolio_id
        and candidate.auth_user_id is null
        and candidate.archived_at is null
        and lower(candidate.email) = lower(new.email)
      order by candidate.created_at, candidate.id
      limit 1
   )
     and not exists (select 1 from public.owners linked where linked.auth_user_id = new.id)
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.hoa_role in ('owner', 'board') and p.disabled_at is null
     );

  -- One vendor record per sign-in (vendors.auth_user_id is unique). With one
  -- record per association, the same email can be on several records: link
  -- the oldest instead of failing the whole sign-up on the second.
  update public.vendors v
     set auth_user_id = new.id, portal_activated = true
   where v.id = (
     select candidate.id
       from public.vendors candidate
      where candidate.portfolio_id = v_portfolio_id
        and candidate.auth_user_id is null
        and candidate.archived_at is null
        -- Never a record already added to another login.
        and not exists (select 1 from public.vendor_portal_logins l where l.vendor_id = candidate.id)
        and exists (
          select 1 from jsonb_array_elements_text(candidate.emails) as e(email)
          where lower(e.email) = lower(new.email)
        )
      order by candidate.created_at, candidate.id
      limit 1
   )
     and not exists (select 1 from public.vendors linked where linked.auth_user_id = new.id)
     -- An invited vendor is linked to the exact record of the invitation when it
     -- is accepted (link_vendor_on_invitation_accept), not to the oldest match.
     and not exists (
       select 1 from public.user_invitations i
       where i.portfolio_id = v_portfolio_id and i.hoa_role::text = 'vendor' and i.status::text = 'pending'
         -- An expired invitation (still 'pending') no longer holds the link.
         and (i.expires_at is null or i.expires_at > now())
         and lower(btrim(i.email)) = lower(btrim(new.email))
     )
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.hoa_role = 'vendor' and p.disabled_at is null
     );

  update public.board_members bm
     set auth_user_id = new.id
   where bm.auth_user_id is null
     and bm.active
     and lower(bm.email) = lower(new.email)
     and exists (
       select 1 from public.profiles p
       where p.id = new.id and p.hoa_role = 'board' and p.disabled_at is null
     )
     and exists (
       select 1 from public.associations a
       where a.id = bm.association_id and a.portfolio_id = v_portfolio_id
     );

  update public.tenants t
     set auth_user_id = new.id,
         portal_activated = true,
         updated_at = now()
   where t.id = (
     select candidate.id
     from public.tenants candidate
     where candidate.portfolio_id = v_portfolio_id
       and candidate.auth_user_id is null
       and candidate.status = 'active'
       and candidate.archived_at is null
       and lower(candidate.email) = lower(new.email)
       and exists (
         select 1 from public.profiles p
         where p.id = new.id and p.hoa_role = 'tenant' and p.disabled_at is null
       )
     order by candidate.created_at desc, candidate.id
     limit 1
   );

  update public.profiles p
     set hoa_role = 'board'
   where p.id = new.id
     and p.hoa_role = 'owner'
     and exists (
       select 1 from public.board_members bm
       where bm.auth_user_id = new.id and bm.active
     );

  return new;
end;
$function$;

create or replace function public.relink_all_portal_users()
returns table(target_table text, rows_linked integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  n_owners integer;
  n_board integer;
  n_vendors integer;
  n_tenants integer;
begin
  -- At most one homeowner record per sign-in: the oldest unlinked match, and
  -- only for sign-ins not linked to a homeowner record yet.
  with pick as (
    select distinct on (u.id) u.id as user_id, o.id as owner_id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role in ('owner', 'board')
      join public.owners o on o.portfolio_id = p.portfolio_id and lower(o.email) = lower(u.email)
     where o.auth_user_id is null
       and o.archived_at is null
       and not exists (select 1 from public.owners linked where linked.auth_user_id = u.id)
     order by u.id, o.created_at, o.id
  ), upd as (
    update public.owners o
       set auth_user_id = pick.user_id
      from pick
     where o.id = pick.owner_id
    returning 1
  ) select count(*) into n_owners from upd;

  with upd as (
    update public.board_members bm
       set auth_user_id = u.id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role = 'board'
     where bm.auth_user_id is null
       and bm.active
       and lower(u.email) = lower(bm.email)
       and exists (
         select 1 from public.associations a
         where a.id = bm.association_id and a.portfolio_id = p.portfolio_id
       )
    returning 1
  ) select count(*) into n_board from upd;

  -- At most one vendor record per sign-in: the oldest unlinked match, and
  -- only for sign-ins not linked to a vendor record yet.
  with pick as (
    select distinct on (u.id) u.id as user_id, v.id as vendor_id
      from auth.users u
      join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role = 'vendor'
      join public.vendors v on v.portfolio_id = p.portfolio_id
     where v.auth_user_id is null
       and v.archived_at is null
       and not exists (select 1 from public.vendor_portal_logins l where l.vendor_id = v.id)
       and exists (
         select 1 from jsonb_array_elements_text(v.emails) as e(email)
         where lower(e.email) = lower(u.email)
       )
       and not exists (select 1 from public.vendors linked where linked.auth_user_id = u.id)
       -- A pending vendor invitation links its exact record when accepted
       -- (link_vendor_on_invitation_accept), as in auto_link_portal_user.
       and not exists (
         select 1 from public.user_invitations i
         where i.portfolio_id = p.portfolio_id and i.hoa_role::text = 'vendor' and i.status::text = 'pending'
           and (i.expires_at is null or i.expires_at > now())
           and lower(btrim(i.email)) = lower(btrim(u.email))
       )
     order by u.id, v.created_at, v.id
  ), upd as (
    update public.vendors v
       set auth_user_id = pick.user_id
      from pick
     where v.id = pick.vendor_id
    returning 1
  ) select count(*) into n_vendors from upd;

  with candidates as (
    select distinct on (u.id) t.id as tenant_id, u.id as auth_user_id
    from auth.users u
    join public.profiles p
      on p.id = u.id
     and p.disabled_at is null
     and p.hoa_role = 'tenant'
    join public.tenants t
      on t.portfolio_id = p.portfolio_id
     and t.auth_user_id is null
     and t.status = 'active'
     and t.archived_at is null
     and lower(u.email) = lower(t.email)
    order by u.id, t.created_at desc, t.id
  ), upd as (
    update public.tenants t
       set auth_user_id = candidates.auth_user_id,
           portal_activated = true,
           updated_at = now()
      from candidates
     where t.id = candidates.tenant_id
    returning 1
  ) select count(*) into n_tenants from upd;

  return query values
    ('owners', n_owners),
    ('board_members', n_board),
    ('vendors', n_vendors),
    ('tenants', n_tenants);
end;
$function$;
