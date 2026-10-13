-- Speed at scale: four more policies check access once per query.
--
-- Measured with 5,000 rows each in rolled-back transactions (2026-10-13):
--   bank_transfers     0.65-0.8 s for every role: app_can_view_bank_account
--                      twice per row (bank account lookup + scope check).
--   owner_attachments  0.25-0.36 s for staff: can_view_owner_row per row.
--   notices            0.48 s on the owner portal: is_notice_recipient per row.
--   agenda_items, meeting_documents, meeting_action_items: 0.76 s for a
--                      company admin at 2,600 meetings:
--                      can_access_confidential_meeting_mvp per meeting.
-- Each per-row call becomes a set computed once per query by a definer
-- helper in rls_private with exactly the same rule. Policies are altered in
-- place (no DROP).

-- Bank accounts a scoped manager may use (app_can_view_bank_account: the
-- account has no association, or it is one of the manager's).
create or replace function rls_private.my_scoped_bank_account_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  select ba.id from public.bank_accounts ba
   where ba.association_id is null
      or ba.association_id in (select public.my_managed_association_ids());
end
$$;

-- Owners a scoped manager may see (can_view_owner_row: an occupancy in one
-- of the manager's associations).
create or replace function rls_private.my_managed_owner_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  select occ.owner_id
    from public.occupancies occ
    join public.association_managers am
      on am.association_id = occ.association_id and am.user_id = auth.uid();
end
$$;

-- Notices addressed to the caller's owner records (is_notice_recipient).
create or replace function rls_private.my_notice_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  select nr.notice_id from public.notice_recipients nr
   where nr.owner_id in (select public.current_owner_ids());
end
$$;

-- Associations whose confidential meeting items the caller may see
-- (can_access_confidential_meeting_mvp, as a set).
create or replace function rls_private.my_confidential_meeting_association_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not coalesce(public.is_current_identity_enabled(), false) then
    return;
  end if;
  if coalesce(public.is_platform_operator(), false) then
    return query select a.id from public.associations a;
    return;
  end if;
  return query
  -- company admin / accountant: every association of their company
  select a.id
    from public.profiles p
    join public.associations a on a.portfolio_id = p.portfolio_id
   where p.id = auth.uid()
     and (p.mvp_role in ('company_admin', 'accountant') or p.hoa_role = 'company_admin')
  union
  -- manager: associations they are assigned to in their company
  select a.id
    from public.profiles p
    join public.association_managers am on am.user_id = p.id and am.ended_at is null
    join public.associations a on a.id = am.association_id and a.portfolio_id = p.portfolio_id
   where p.id = auth.uid()
     and (p.mvp_role = 'manager' or (p.mvp_role is null and p.hoa_role = 'manager'))
  union
  -- assistant manager: same, if not disabled
  select a.id
    from public.profiles p
    join public.association_managers am on am.user_id = p.id and am.ended_at is null
    join public.associations a on a.id = am.association_id and a.portfolio_id = p.portfolio_id
   where p.id = auth.uid()
     and p.disabled_at is null
     and p.mvp_role = 'assistant_manager'
  union
  -- active board member
  select bm.association_id
    from public.board_members bm
   where bm.auth_user_id = auth.uid()
     and bm.active = true
     and bm.association_id is not null;
end
$$;

do $$
declare f text;
begin
  foreach f in array array['my_scoped_bank_account_ids', 'my_managed_owner_ids', 'my_notice_ids', 'my_confidential_meeting_association_ids'] loop
    execute format('revoke all on function rls_private.%I() from public, anon', f);
    execute format('grant execute on function rls_private.%I() to authenticated, service_role', f);
  end loop;
end
$$;

alter policy mgr_assoc_scope on public.bank_transfers
  using (((select public.manager_is_scoped()) is not true)
         or (from_bank_account_id in (select rls_private.my_scoped_bank_account_ids())
             and to_bank_account_id in (select rls_private.my_scoped_bank_account_ids())));

alter policy mgr_assoc_scope on public.owner_attachments
  using (((select public.manager_is_scoped()) is not true)
         or owner_id in (select rls_private.my_managed_owner_ids()))
  with check (((select public.manager_is_scoped()) is not true)
         or owner_id in (select rls_private.my_managed_owner_ids()));

alter policy notices_resident_read on public.notices
  using ((select public.is_portal_resident())
         and status = 'sent'::notice_status
         and ((send_to is null and association_id in (select public.current_resident_association_ids()))
              or id in (select rls_private.my_notice_ids())));

do $$
declare t text;
begin
  foreach t in array array['agenda_items', 'meeting_documents', 'meeting_action_items'] loop
    execute format($p$
      alter policy %I on public.%I
        using (exists (
          select 1
            from public.meetings m
            join public.associations a on a.id = m.association_id and a.portfolio_id = m.portfolio_id
           where m.id = %I.meeting_id
             and (coalesce(m.portfolio_id = (select public.my_access_portfolio()), false)
                  or ((select public.is_platform_operator()) and m.portfolio_id is not null))
             and m.association_id in (select rls_private.my_confidential_meeting_association_ids())))$p$,
      t || '_staff_select', t, t);
  end loop;
end
$$;
