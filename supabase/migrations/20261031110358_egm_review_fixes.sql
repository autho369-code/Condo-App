-- Fixes from the 2026-10-31 Elephant-Goldfish review (docs/reviews/2026-10-31-egm).
-- Each section restores a rule already written in docs/brain; no rule changes.

-- 1. A buyer can't read the seller's payment history (ownership fixes). The
--    owner read rule admitted every payment on the unit. Now: payments from
--    the owner's move-in on, plus applications on charges the owner can
--    already see (the seller's still-open charges stay visible, "the debt
--    stays with the unit", and their balances must still add up). The helper
--    is plpgsql (Product Rules: RLS helpers can't be inlined per row).
create or replace function rls_private.resident_visible_payment_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  select p.id
    from public.payments p
    join rls_private.resident_unit_tenure() t on t.unit_id = p.unit_id
   where t.since is null or p.payment_date >= t.since;
end
$$;

drop policy if exists payment_apps_resident_read on public.payment_applications;
create policy payment_apps_resident_read on public.payment_applications
  for select to authenticated
  using (
    payment_id in (select rls_private.resident_visible_payment_ids())
    or charge_id in (select rls_private.resident_visible_charge_ids())
  );

-- 2. Email holds: operators write only with role admin, as on every other
--    table (ROLE_ACCESS_MATRIX).
drop policy if exists operator_writes_need_admin_insert on public.email_hold_associations;
drop policy if exists operator_writes_need_admin_update on public.email_hold_associations;
drop policy if exists operator_writes_need_admin_delete on public.email_hold_associations;
create policy operator_writes_need_admin_insert on public.email_hold_associations
  as restrictive for insert to authenticated
  with check ((select public.operator_may_write(false)));
create policy operator_writes_need_admin_update on public.email_hold_associations
  as restrictive for update to authenticated
  using ((select public.operator_may_write(false)))
  with check ((select public.operator_may_write(false)));
create policy operator_writes_need_admin_delete on public.email_hold_associations
  as restrictive for delete to authenticated
  using ((select public.operator_may_write(false)));
drop trigger if exists operator_write_guard on public.email_hold_associations;
create trigger operator_write_guard
  before insert or update or delete on public.email_hold_associations
  for each statement execute function public.operator_write_guard('false');

-- 3. Work order messages: a vendor or owner posts only as themselves. The
--    vendor rule did not check the author; the name was never checked for
--    either. A trigger sets both from the signed-in user.
drop policy if exists wo_msg_vendor_insert on public.work_order_messages;
create policy wo_msg_vendor_insert on public.work_order_messages
  for insert to authenticated
  with check (
    author_role = 'vendor'
    and author_id = (select auth.uid())
    and exists (
      select 1 from public.work_orders wo
       where wo.id = work_order_messages.work_order_id
         and wo.archived_at is null
         and wo.vendor_id in (select public.current_vendor_ids())
    )
  );

create or replace function public.work_order_message_author()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is not null and new.author_role in ('vendor', 'owner') then
    new.author_id := auth.uid();
    select coalesce(nullif(btrim(p.full_name), ''), u.email)
      into new.author_name
      from auth.users u
      left join public.profiles p on p.id = u.id
     where u.id = auth.uid();
  end if;
  return new;
end
$$;
revoke execute on function public.work_order_message_author() from public, anon, authenticated;

drop trigger if exists work_order_messages_author on public.work_order_messages;
create trigger work_order_messages_author
  before insert on public.work_order_messages
  for each row execute function public.work_order_message_author();

-- 4. Pets and tenants stay in their unit's company (the app checked it;
--    a direct API write could point a row at another company's unit).
create or replace function public.unit_row_same_company()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_portfolio uuid;
  v_association uuid;
begin
  if new.unit_id is null then
    return new;
  end if;
  select a.portfolio_id, a.id into v_portfolio, v_association
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = new.unit_id;
  if not found or v_portfolio is distinct from new.portfolio_id then
    raise exception 'That unit is not in this company' using errcode = '42501';
  end if;
  if tg_table_name = 'tenants' then
    if new.association_id is not null and new.association_id <> v_association then
      raise exception 'That unit is not in this association' using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;
revoke execute on function public.unit_row_same_company() from public, anon, authenticated;

drop trigger if exists unit_pets_same_company on public.unit_pets;
create trigger unit_pets_same_company
  before insert or update of unit_id, portfolio_id on public.unit_pets
  for each row execute function public.unit_row_same_company();
drop trigger if exists tenants_same_company on public.tenants;
create trigger tenants_same_company
  before insert or update of unit_id, portfolio_id, association_id on public.tenants
  for each row execute function public.unit_row_same_company();

-- 5. Vendors read only the calendar fields meant for them. A policy can't
--    hide columns (Product Rules), so the vendor read goes through a function.
drop policy if exists calendar_events_vendor_read on public.calendar_events;
create policy calendar_events_vendor_read on public.calendar_events
  for select to authenticated
  using (false);

create or replace function public.vendor_calendar_events(p_until timestamptz)
returns table (
  id uuid,
  title text,
  start_datetime timestamptz,
  location text,
  operations_status text,
  maintenance_task_id uuid,
  vendor_id uuid,
  association_name text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  select e.id, e.title, e.start_datetime, e.location, e.operations_status,
         e.maintenance_task_id, e.vendor_id, a.name
    from public.calendar_events e
    left join public.associations a on a.id = e.association_id
   where e.vendor_id in (select public.current_vendor_ids())
     and e.archived_at is null
     and e.start_datetime <= p_until
     and (e.start_datetime >= now() or e.operations_status = 'scheduled')
   order by e.start_datetime
   limit 500;
end
$$;
revoke execute on function public.vendor_calendar_events(timestamptz) from public, anon;
grant execute on function public.vendor_calendar_events(timestamptz) to authenticated;

-- 6. Email hold matches whole addresses, not substrings (jo@x.com was held
--    because bjo@x.com is an owner's).
create or replace function public.email_list_has(p_list text, p_addr text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(p_addr, '') <> ''
     and lower(btrim(p_addr)) = any (regexp_split_to_array(lower(coalesce(p_list, '')), '[\s,;<>\[\]{}"]+'));
$$;
revoke execute on function public.email_list_has(text, text) from public, anon;

create or replace function public.email_is_held(p_association_id uuid, p_owner_id uuid, p_to_email text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  with a as (select lower(btrim(coalesce(p_to_email, ''))) as addr),
       h as (select association_id from public.email_hold_associations)
  select
    -- Emergency switch: every company's owners and tenants.
    (public.resident_email_on_hold() and public.email_is_to_resident(p_owner_id, p_to_email))
    or (exists (select 1 from h) and (
      -- The row names an owner of a held association.
      exists (select 1 from public.owners o
               where o.id = p_owner_id
                 and (o.association_id in (select association_id from h)
                      or exists (select 1 from public.unit_owners uo
                                   join public.units u on u.id = uo.unit_id
                                   join public.buildings b on b.id = u.building_id
                                  where uo.owner_id = o.id
                                    and b.association_id in (select association_id from h))))
      -- An owner-less row of a held association with no address.
      or (p_association_id in (select association_id from h) and (select addr from a) = '')
      -- The address belongs to someone in a held association (whole addresses
      -- only; one field can hold several).
      or ((select addr from a) <> '' and (
            exists (select 1 from public.owners o
                     where public.email_list_has(coalesce(o.email, '') || ' ' || coalesce(o.emails::text, ''), (select addr from a))
                       and (o.association_id in (select association_id from h)
                            or exists (select 1 from public.unit_owners uo
                                         join public.units u on u.id = uo.unit_id
                                         join public.buildings b on b.id = u.building_id
                                        where uo.owner_id = o.id
                                          and b.association_id in (select association_id from h))))
         or exists (select 1 from public.board_members bm
                     where bm.association_id in (select association_id from h)
                       and public.email_list_has(bm.email, (select addr from a)))
         or exists (select 1 from public.tenants t
                     where (t.association_id in (select association_id from h)
                            -- association_id can be empty on a tenant: match by unit too.
                            or exists (select 1 from public.units u
                                         join public.buildings b on b.id = u.building_id
                                        where u.id = t.unit_id
                                          and b.association_id in (select association_id from h)))
                       and public.email_list_has(t.email, (select addr from a)))
         or exists (select 1 from public.tenancies tn
                      join public.units u on u.id = tn.unit_id
                      join public.buildings b on b.id = u.building_id
                     where b.association_id in (select association_id from h)
                       and public.email_list_has(tn.tenant_email, (select addr from a)))))));
$function$;

-- 7. Vendor logins are linked only by their own invitation, never by a
--    matching email (Product Rules, Decisions #265).
create or replace function public.link_portal_user(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_portfolio_id uuid;
begin
  select p.portfolio_id into v_portfolio_id
  from public.profiles p
  where p.id = p_user_id and p.disabled_at is null;

  if v_portfolio_id is null or p_email is null then
    return;
  end if;

  -- Owner and vendor records are not linked here: only their own invitation
  -- links them (link_owner_on_invitation_accept,
  -- link_vendor_on_invitation_accept), never a matching email.

  update public.board_members bm
     set auth_user_id = p_user_id
   where bm.auth_user_id is null
     and bm.active
     and lower(bm.email) = lower(p_email)
     and exists (
       select 1 from public.profiles p
       where p.id = p_user_id and p.hoa_role = 'board' and p.disabled_at is null
     )
     and exists (
       select 1 from public.associations a
       where a.id = bm.association_id and a.portfolio_id = v_portfolio_id
     );

  update public.tenants t
     set auth_user_id = p_user_id,
         portal_activated = true,
         updated_at = now()
   where t.id = (
     select candidate.id
     from public.tenants candidate
     where candidate.portfolio_id = v_portfolio_id
       and candidate.auth_user_id is null
       and candidate.status = 'active'
       and candidate.archived_at is null
       and lower(candidate.email) = lower(p_email)
       and exists (
         select 1 from public.profiles p
         where p.id = p_user_id and p.hoa_role = 'tenant' and p.disabled_at is null
       )
     order by candidate.created_at desc, candidate.id
     limit 1
   );

  update public.profiles p
     set hoa_role = 'board'
   where p.id = p_user_id
     and p.hoa_role = 'owner'
     and exists (
       select 1 from public.board_members bm
       where bm.auth_user_id = p_user_id and bm.active
     );
end;
$function$;

do $$
declare
  v_def text := replace(pg_get_functiondef('public.relink_all_portal_users()'::regprocedure), chr(13), '');
  v_start int := position('  -- At most one vendor record per sign-in' in v_def);
  v_end int := position(') select count(*) into n_vendors from upd;' in v_def);
begin
  if position('n_vendors := 0;' in v_def) > 0 then
    return;
  end if;
  if v_start = 0 or v_end = 0 or v_end < v_start then
    raise exception 'relink_all_portal_users: vendor block not found';
  end if;
  v_def := substr(v_def, 1, v_start - 1)
        || '  -- Vendor records are linked only by their own invitations, never by email.' || chr(10)
        || '  n_vendors := 0;'
        || substr(v_def, v_end + length(') select count(*) into n_vendors from upd;'));
  execute v_def;
end
$$;

-- 8. Staff can't insert an approval request that already looks decided:
--    every new request starts pending with no votes (the board's decision is
--    recorded through record_approval_decision).
drop policy if exists approval_requests_insert_guard on public.approval_requests;
create policy approval_requests_insert_guard on public.approval_requests
  as restrictive for insert to authenticated
  with check (
    status = 'pending'::public.approval_request_status
    and coalesce(votes_for, 0) = 0
    and coalesce(votes_against, 0) = 0
    and coalesce(votes_abstain, 0) = 0
    and decision_by is null
    and decision_at is null
    and (
      coalesce(portfolio_id = (select public.my_access_portfolio()), false)
      or ((select public.is_platform_operator()) and portfolio_id is not null)
      or (
        owner_id is not null
        and owner_id in (select public.current_owner_ids())
        and public.owner_record_matches(owner_id, association_id, unit_id)
        and association_id in (select public.current_resident_association_ids())
        and (unit_id is null or unit_id in (select public.current_resident_unit_ids()))
        and portfolio_id = (select a.portfolio_id from public.associations a where a.id = approval_requests.association_id)
        and coalesce(cardinality(board_member_ids), 0) = 0
      )
    )
  );

--    Which requests sit behind a bill or purchase order (decided on that
--    page, by finance staff). Only finance staff can read bills and POs, so
--    other managers need this to tell general requests apart. Returns ids only.
create or replace function public.money_approval_request_ids(p_ids uuid[])
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not (select public.is_any_staff()) and not (select public.is_company_admin())
     and not (select public.is_platform_operator()) then
    return;
  end if;
  return query
  select b.approval_request_id from public.payable_bills b
   where b.approval_request_id = any (p_ids)
     and public.can_access_portfolio(b.portfolio_id)
  union
  select po.approval_request_id from public.purchase_orders po
   where po.approval_request_id = any (p_ids)
     and public.can_access_portfolio(po.portfolio_id);
end
$$;
revoke execute on function public.money_approval_request_ids(uuid[]) from public, anon;
grant execute on function public.money_approval_request_ids(uuid[]) to authenticated;

-- 9. A bill's board routing is decided at submit from the association's
--    current settings (Product Rules), as purchase orders already do: a
--    threshold tightened after the draft was saved now applies.
do $$
declare
  v_def text := replace(pg_get_functiondef('public.request_payable_bill_approval(uuid)'::regprocedure), chr(13), '');
  v_parts text[][] := array[
    array[$o$  vendor_name text;
begin$o$, $n$  vendor_name text;
  v_board_mode text;
  v_board_threshold numeric;
begin$n$],
    array[$o$  if bill_row.approval_request_id is not null then return bill_row.approval_request_id; end if;
$o$, $n$  if bill_row.approval_request_id is not null then return bill_row.approval_request_id; end if;

  -- Board routing follows the association's settings now, not when the draft
  -- was saved.
  if not bill_row.approval_required and bill_row.association_id is not null then
    select coalesce(s.sends_bills_to_board, 'never'), s.bills_threshold
      into v_board_mode, v_board_threshold
      from public.board_approval_settings s
     where s.association_id = bill_row.association_id;
    if coalesce(v_board_mode, 'never') = 'always'
       or (v_board_mode = 'over_threshold' and bill_row.amount >= coalesce(v_board_threshold, 0)) then
      update public.payable_bills set approval_required = true where id = p_bill_id;
      bill_row.approval_required := true;
    end if;
  end if;
$n$]
  ];
  i integer;
  v_old text;
begin
  if position('v_board_threshold' in v_def) > 0 then
    return;
  end if;
  for i in 1 .. array_length(v_parts, 1) loop
    v_old := replace(v_parts[i][1], chr(13), '');
    if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'request_payable_bill_approval: part % not found exactly once', i;
    end if;
    v_def := replace(v_def, v_old, replace(v_parts[i][2], chr(13), ''));
  end loop;
  execute v_def;
end
$$;

-- 10. The chart of accounts is entered and changed by the company admin
--     (Product Rules, Decisions). Finance staff keep reading it.
drop policy if exists gl_accounts_admin_insert on public.gl_accounts;
drop policy if exists gl_accounts_admin_update on public.gl_accounts;
drop policy if exists gl_accounts_admin_delete on public.gl_accounts;
create policy gl_accounts_admin_insert on public.gl_accounts
  as restrictive for insert to authenticated
  with check ((select public.is_company_admin()) or (select public.is_platform_operator()));
create policy gl_accounts_admin_update on public.gl_accounts
  as restrictive for update to authenticated
  using ((select public.is_company_admin()) or (select public.is_platform_operator()))
  with check ((select public.is_company_admin()) or (select public.is_platform_operator()));
create policy gl_accounts_admin_delete on public.gl_accounts
  as restrictive for delete to authenticated
  using ((select public.is_company_admin()) or (select public.is_platform_operator()));
