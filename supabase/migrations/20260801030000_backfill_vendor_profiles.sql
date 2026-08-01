-- getMe() signs out any authenticated user without a profiles row
-- (isActiveProfile requires the record to exist), so portal-activated vendors
-- created before profiles became mandatory are locked out with
-- "account_disabled". Backfill a vendor-shaped profile for every linked,
-- active vendor login that lacks one. Idempotent.
insert into public.profiles (id, email, full_name, display_name, portfolio_id, role)
select v.auth_user_id, u.email, v.name, v.name, v.portfolio_id, 'vendor'
from public.vendors v
join auth.users u on u.id = v.auth_user_id
left join public.profiles p on p.id = v.auth_user_id
where v.auth_user_id is not null
  and v.portal_activated
  and v.archived_at is null
  and p.id is null
on conflict (id) do nothing;
