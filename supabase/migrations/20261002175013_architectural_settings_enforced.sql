-- architectural_review_settings were saved but never read: owners could still
-- submit requests online after an association turned online requests off,
-- and the default committee was never applied. Enforce both on insert.
create or replace function public.apply_architectural_review_settings()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  s public.architectural_review_settings%rowtype;
begin
  select * into s from public.architectural_review_settings where association_id = new.association_id;
  if not found then
    return new;
  end if;
  if coalesce(s.online_requests_disabled, false) and not public.is_any_staff() then
    raise exception 'This association does not take architectural requests online. Please contact your management office.'
      using errcode = '42501';
  end if;
  if new.committee_id is null then
    new.committee_id := s.default_committee_id;
  end if;
  return new;
end;
$$;
revoke all on function public.apply_architectural_review_settings() from public, anon, authenticated;

create trigger architectural_requests_apply_settings
  before insert on public.architectural_requests
  for each row execute function public.apply_architectural_review_settings();
