-- Follow-ups from the Elephant-Goldfish goldfish reviews of #420 (design
-- critic, zoom-out, codebase details): docs/reviews/2026-10-31-egm/pr420/.

-- 1. Email hold: back to the broad match. Whole-address matching could release
--    mail to a held (real) resident whose address is stored oddly
--    ('a@x.com/b@x.com', 'mailto:a@x.com'). Over-holding is the safe direction
--    (20261027010000); this body is that migration's, unchanged.
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
      -- The address belongs to someone in a held association (position(): no
      -- wildcards; one field can hold several addresses).
      or ((select addr from a) <> '' and (
            exists (select 1 from public.owners o
                     where position((select addr from a) in lower(coalesce(o.email, '') || ' ' || coalesce(o.emails::text, ''))) > 0
                       and (o.association_id in (select association_id from h)
                            or exists (select 1 from public.unit_owners uo
                                         join public.units u on u.id = uo.unit_id
                                         join public.buildings b on b.id = u.building_id
                                        where uo.owner_id = o.id
                                          and b.association_id in (select association_id from h))))
         or exists (select 1 from public.board_members bm
                     where bm.association_id in (select association_id from h)
                       and position((select addr from a) in lower(coalesce(bm.email, ''))) > 0)
         or exists (select 1 from public.tenants t
                     where (t.association_id in (select association_id from h)
                            -- association_id can be empty on a tenant: match by unit too.
                            or exists (select 1 from public.units u
                                         join public.buildings b on b.id = u.building_id
                                        where u.id = t.unit_id
                                          and b.association_id in (select association_id from h)))
                       and position((select addr from a) in lower(coalesce(t.email, ''))) > 0)
         or exists (select 1 from public.tenancies tn
                      join public.units u on u.id = tn.unit_id
                      join public.buildings b on b.id = u.building_id
                     where b.association_id in (select association_id from h)
                       and position((select addr from a) in lower(coalesce(tn.tenant_email, ''))) > 0)))));
$function$;
revoke all on function public.email_is_held(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.email_is_held(uuid, uuid, text) to service_role;

-- 2. platform_flags (created 2026-10-26, after the 2026-10-05 operator sweep)
--    holds the platform-wide resident-email switch: operator writes need an
--    admin, as on every other table. (profiles, user_sessions and
--    login_attempts already have stricter guards from 20261005074000,
--    20261005075900 and 20261005075950.)
drop policy if exists operator_writes_need_admin_update on public.platform_flags;
create policy operator_writes_need_admin_update on public.platform_flags
  as restrictive for update to authenticated
  using ((select public.operator_may_write(false)))
  with check ((select public.operator_may_write(false)));
drop trigger if exists operator_write_guard on public.platform_flags;
create trigger operator_write_guard
  before insert or update or delete on public.platform_flags
  for each statement execute function public.operator_write_guard('false');

-- 3. Work order messages: the author is who posted. The app posts as
--    'owner', 'vendor' or 'staff'; the database sets the author's id and name
--    from the signed-in user, refuses an owner or vendor label from someone
--    who isn't one (and any other role, e.g. 'board': the board portal is
--    read-only), and keeps the author unchanged on later edits.
create or replace function public.work_order_message_author()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.author_id := old.author_id;
    new.author_name := old.author_name;
    new.author_role := old.author_role;
    return new;
  end if;
  if new.author_role is null or new.author_role not in ('owner', 'vendor', 'staff') then
    raise exception 'Work order messages are posted by staff, owners or vendors' using errcode = '42501';
  end if;
  if new.author_role = 'owner' and not public.is_portal_resident() then
    raise exception 'Only an owner can post as an owner' using errcode = '42501';
  end if;
  if new.author_role = 'vendor' and not exists (select 1 from public.current_vendor_ids()) then
    raise exception 'Only a vendor can post as a vendor' using errcode = '42501';
  end if;
  new.author_id := auth.uid();
  select coalesce(nullif(btrim(p.full_name), ''), u.email)
    into new.author_name
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.id = auth.uid();
  return new;
end
$$;
revoke execute on function public.work_order_message_author() from public, anon, authenticated;

drop trigger if exists work_order_messages_author on public.work_order_messages;
create trigger work_order_messages_author
  before insert or update on public.work_order_messages
  for each row execute function public.work_order_message_author();

--    The vendor rule reads work orders through a helper (Product Rules: no
--    inline subqueries over RLS tables inside policies). The trigger above
--    sets the author, so the rule needn't check it.
create or replace function rls_private.vendor_postable_work_order_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  select wo.id from public.work_orders wo
   where wo.archived_at is null
     and wo.vendor_id in (select public.current_vendor_ids());
end
$$;
revoke execute on function rls_private.vendor_postable_work_order_ids() from public, anon;
grant execute on function rls_private.vendor_postable_work_order_ids() to authenticated;

drop policy if exists wo_msg_vendor_insert on public.work_order_messages;
create policy wo_msg_vendor_insert on public.work_order_messages
  for insert to authenticated
  with check (
    author_role = 'vendor'
    and work_order_id in (select rls_private.vendor_postable_work_order_ids())
  );

-- 4. Pets and tenants: the owner (and the pet's tenant) named on the row is in
--    the unit's company too, not only the unit.
create or replace function public.unit_row_same_company()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_portfolio uuid;
  v_association uuid;
  v_place_changed boolean;
begin
  -- On an update only a link that changed to a value is checked, so a
  -- delete elsewhere that clears a link (ON DELETE SET NULL) never trips it.
  v_place_changed := tg_op = 'INSERT'
    or new.unit_id is distinct from old.unit_id
    or new.portfolio_id is distinct from old.portfolio_id;
  if tg_table_name = 'tenants' and tg_op = 'UPDATE' then
    v_place_changed := v_place_changed or new.association_id is distinct from old.association_id;
  end if;

  if new.unit_id is not null and v_place_changed then
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
  end if;

  if new.owner_id is not null
     and (tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id or new.portfolio_id is distinct from old.portfolio_id)
     and not exists (select 1 from public.owners o where o.id = new.owner_id and o.portfolio_id = new.portfolio_id) then
    raise exception 'That owner is not in this company' using errcode = '42501';
  end if;
  if tg_table_name = 'unit_pets' then
    if new.tenant_id is not null
       and (tg_op = 'INSERT' or new.tenant_id is distinct from old.tenant_id or new.portfolio_id is distinct from old.portfolio_id)
       and not exists (select 1 from public.tenants t where t.id = new.tenant_id and t.portfolio_id = new.portfolio_id) then
      raise exception 'That tenant is not in this company' using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;
revoke execute on function public.unit_row_same_company() from public, anon, authenticated;

drop trigger if exists unit_pets_same_company on public.unit_pets;
create trigger unit_pets_same_company
  before insert or update of unit_id, portfolio_id, owner_id, tenant_id on public.unit_pets
  for each row execute function public.unit_row_same_company();
drop trigger if exists tenants_same_company on public.tenants;
create trigger tenants_same_company
  before insert or update of unit_id, portfolio_id, association_id, owner_id on public.tenants
  for each row execute function public.unit_row_same_company();

-- 5. Vendor calendar: upcoming visits first (soonest first), then overdue
--    visits newest first, so the row cap drops the oldest overdue visits,
--    never upcoming ones.
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
   order by (e.start_datetime < now()),
            case when e.start_datetime >= now() then e.start_datetime end,
            e.start_datetime desc
   limit 500;
end
$$;

-- 6. Unused helpers stay but can't be called.
revoke execute on function rls_private.resident_payment_ids() from authenticated;
--    email_list_has (20261031110358) is unused since section 1.
revoke execute on function public.email_list_has(text, text) from public, anon, authenticated;

-- 7. Chart of accounts: the company admin of this company (the pattern the
--    other company-admin writes use), or a platform operator.
drop policy if exists gl_accounts_admin_insert on public.gl_accounts;
drop policy if exists gl_accounts_admin_update on public.gl_accounts;
drop policy if exists gl_accounts_admin_delete on public.gl_accounts;
create policy gl_accounts_admin_insert on public.gl_accounts
  as restrictive for insert to authenticated
  with check (coalesce(portfolio_id = (select public.my_admin_portfolio()), false) or ((select public.is_platform_operator()) and portfolio_id is not null));
create policy gl_accounts_admin_update on public.gl_accounts
  as restrictive for update to authenticated
  using (coalesce(portfolio_id = (select public.my_admin_portfolio()), false) or ((select public.is_platform_operator()) and portfolio_id is not null))
  with check (coalesce(portfolio_id = (select public.my_admin_portfolio()), false) or ((select public.is_platform_operator()) and portfolio_id is not null));
create policy gl_accounts_admin_delete on public.gl_accounts
  as restrictive for delete to authenticated
  using (coalesce(portfolio_id = (select public.my_admin_portfolio()), false) or ((select public.is_platform_operator()) and portfolio_id is not null));

-- 8. The two functions #420 patched by text replacement, written out in full
--    so the repo holds their readable source.
create or replace function public.relink_all_portal_users()
returns table(target_table text, rows_linked integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  n_owners integer;
  n_board integer;
  n_vendors integer;
  n_tenants integer;
begin
  -- Owner records are linked only by their own invitations, never by email.
  n_owners := 0;

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

  -- Vendor records are linked only by their own invitations, never by email.
  n_vendors := 0;

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

create or replace function public.request_payable_bill_approval(p_bill_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  bill_row public.payable_bills;
  settings_row public.board_approval_settings;
  member_ids uuid[];
  member_count integer;
  required_count integer;
  request_id uuid;
  vendor_name text;
  v_board_mode text;
  v_board_threshold numeric;
begin
  select * into bill_row from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if not public.can_manage_finance(bill_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if not public.can_view_association_row(bill_row.association_id) then raise exception 'Bill not found'; end if;
  if not public.operator_may_write(false) then raise exception 'Permission denied'; end if;
  if bill_row.status not in ('draft'::public.payable_bill_status, 'pending_approval'::public.payable_bill_status) then
    raise exception 'Only draft or pending bills can be submitted for approval';
  end if;
  if bill_row.approval_request_id is not null then return bill_row.approval_request_id; end if;

  -- The association's board setting is checked again now, at submit: a
  -- threshold tightened after the draft was saved applies. This only adds the
  -- board: approval_required also holds staff's own "send to the board"
  -- choice, which a looser setting must not undo. (Purchase orders recompute
  -- both ways because they have no such choice.)
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

  -- po_decisions: a bill within a board-approved PO's amount (checked now,
  -- with every bill on the PO) doesn't go to the board again.
  if bill_row.approval_required and bill_row.purchase_order_id is not null
     and public.payable_bill_within_board_approved_po(p_bill_id) then
    update public.payable_bills set approval_required = false where id = p_bill_id;
    bill_row.approval_required := false;
  end if;

  if not bill_row.approval_required then
    update public.payable_bills
       set status = 'pending_approval'::public.payable_bill_status, updated_at = now()
     where id = p_bill_id;
    return null;
  end if;
  if bill_row.association_id is null then
    raise exception 'Board-approved bills require an association';
  end if;

  select * into settings_row from public.board_approval_settings
   where association_id = bill_row.association_id;
  select coalesce(array_agg(bm.id order by bm.id), '{}'::uuid[])
    into member_ids
    from public.board_members bm
   where bm.association_id = bill_row.association_id
     and bm.active
     and (
       coalesce(cardinality(settings_row.default_board_member_ids), 0) = 0
       or bm.id = any(settings_row.default_board_member_ids)
     );
  member_count := coalesce(cardinality(member_ids), 0);
  if member_count = 0 then raise exception 'No active board approvers are configured'; end if;

  settings_row.default_voting_scheme := coalesce(settings_row.default_voting_scheme, 'majority_approval_required'::public.voting_scheme);
  settings_row.signatures_required := coalesce(settings_row.signatures_required, true);
  required_count := case settings_row.default_voting_scheme
    when 'any_one_approver'::public.voting_scheme then 1
    when 'unanimous_approval_required'::public.voting_scheme then member_count
    when 'percentage_required'::public.voting_scheme then greatest(1, ceil(member_count * coalesce(settings_row.default_percentage_required, 100) / 100.0)::integer)
    else floor(member_count / 2.0)::integer + 1
  end;
  select name into vendor_name from public.vendors where id = bill_row.vendor_id;

  insert into public.approval_requests (
    portfolio_id, association_id, vendor_id, request_type, title, description,
    requested_by_name, requested_by_email, amount, due_date, status,
    voting_scheme, required_votes, signatures_required, board_member_ids,
    percentage_required, requested_at
  ) values (
    bill_row.portfolio_id, bill_row.association_id, bill_row.vendor_id, 'expense',
    'Bill ' || coalesce(nullif(trim(bill_row.bill_number), ''), left(bill_row.id::text, 8)) || ' ' || chr(8212) || ' ' || coalesce(vendor_name, 'Vendor'),
    bill_row.memo, coalesce((select full_name from public.profiles where id = auth.uid()), 'Management staff'),
    (select email from auth.users where id = auth.uid()), bill_row.amount, bill_row.due_date, 'pending',
    settings_row.default_voting_scheme, required_count, settings_row.signatures_required,
    member_ids, settings_row.default_percentage_required, now()
  ) returning id into request_id;

  update public.payable_bills
     set status = 'pending_approval'::public.payable_bill_status,
         approval_request_id = request_id,
         updated_at = now()
   where id = p_bill_id;
  return request_id;
end;
$function$;

-- 9. The owner read rule on payment applications carries the same resident
--    gate as its sibling rule on payments.
drop policy if exists payment_apps_resident_read on public.payment_applications;
create policy payment_apps_resident_read on public.payment_applications
  for select to authenticated
  using (
    (select public.is_portal_resident())
    and (
      payment_id in (select rls_private.resident_visible_payment_ids())
      or charge_id in (select rls_private.resident_visible_charge_ids())
    )
  );
