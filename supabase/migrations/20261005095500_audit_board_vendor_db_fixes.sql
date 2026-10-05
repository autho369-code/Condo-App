-- Role audit fixes (board + vendor).
--
-- 1. Board delinquency figures: aged_receivables / v_charge_balances are
--    security_invoker views that subtract payment_applications, which board
--    members could not read, so every paid charge counted as unpaid (board saw
--    $8,550 overdue vs $2,250 real). Board members may read applications for
--    payments on units in their own associations (read only).
create policy payment_apps_board_read on public.payment_applications
  for select to authenticated
  using (
    is_board_user()
    and exists (
      select 1
        from public.payments p
        join public.units u on u.id = p.unit_id
        join public.buildings b on b.id = u.building_id
       where p.id = payment_applications.payment_id
         and b.association_id in (select current_board_association_ids())));

-- 2. Board discussion posts could carry a spoofed author_id via the API.
alter policy arch_msg_board_insert on public.architectural_request_messages
  with check (
    author_role = 'board'
    and author_id = (select auth.uid())
    and exists (
      select 1 from public.architectural_requests r
       where r.id = architectural_request_messages.request_id
         and r.association_id in (select current_board_association_ids())));

-- 3. invite_vendor is unused and mints a 'manager' invitation; nobody may call it.
revoke execute on function public.invite_vendor from public, anon, authenticated;

-- 4. An existing account accepting a vendor invitation got hoa_role='vendor'
--    but was never linked to its vendor row (only the signup trigger linked),
--    so current_vendor_id() stayed null and the portal bounced them. Link on
--    acceptance, matching the signup trigger's rule (same company, unlinked,
--    email on the vendor record).
create or replace function public.link_vendor_on_invitation_accept()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  if new.hoa_role::text = 'vendor'
     and new.status::text = 'accepted' and old.status::text is distinct from 'accepted'
     and new.used_by is not null then
    update public.vendors v
       set auth_user_id = new.used_by, portal_activated = true
     where v.portfolio_id = new.portfolio_id
       and v.auth_user_id is null
       and v.archived_at is null
       and exists (
         select 1 from jsonb_array_elements_text(v.emails) as e(email)
          where lower(e.email) = lower(new.email));
  end if;
  return new;
end $$;

revoke execute on function public.link_vendor_on_invitation_accept() from public, anon, authenticated;

create trigger user_invitations_link_vendor
  after update on public.user_invitations
  for each row execute function public.link_vendor_on_invitation_accept();
