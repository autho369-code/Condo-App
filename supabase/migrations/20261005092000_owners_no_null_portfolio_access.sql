-- Owners (and their staff-only notes in owner_private) with a NULL
-- portfolio_id were readable and writable by staff of EVERY company:
-- owners_staff_all allowed "portfolio_id IS NULL OR portfolio_id =
-- current_portfolio_id()", and a staff insert with no portfolio passed the
-- check, so one company could create an owner (with private notes) that
-- every other company could then see and edit. No such rows exist today and
-- every app insert sets portfolio_id. Platform operators keep access through
-- is_platform_operator().
alter policy owners_staff_all on public.owners
  using (is_platform_operator() or ((is_any_staff() or is_company_admin()) and portfolio_id = current_portfolio_id()))
  with check (is_platform_operator() or ((is_any_staff() or is_company_admin()) and portfolio_id = current_portfolio_id()));

alter policy owner_private_staff on public.owner_private
  using (exists (
    select 1 from public.owners o
     where o.id = owner_private.owner_id
       and (is_platform_operator() or ((is_any_staff() or is_company_admin()) and o.portfolio_id = current_portfolio_id()))))
  with check (exists (
    select 1 from public.owners o
     where o.id = owner_private.owner_id
       and (is_platform_operator() or ((is_any_staff() or is_company_admin()) and o.portfolio_id = current_portfolio_id()))));
