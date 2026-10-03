-- Post every recurring occurrence up to the through date (a year of daily
-- entries is 366), not just the first 12, for journal entries and bills.
-- Also re-applies the posted-entry guard so any direct change to a posted
-- entry is refused (same definition as 20261003181000).
do $$
declare def text;
begin
  def := pg_get_functiondef('public.generate_recurring_journal_entries_through(uuid, date, boolean)'::regprocedure);
  if position('v_guard < 12' in def) > 0 then execute replace(def, 'v_guard < 12', 'v_guard < 400'); end if;
  def := pg_get_functiondef('public.generate_recurring_bills_through(uuid, date, boolean)'::regprocedure);
  if position('v_guard < 12' in def) > 0 then execute replace(def, 'v_guard < 12', 'v_guard < 400'); end if;
end $$;

create or replace function public.guard_posted_journal_entry()
returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $$
begin
  if current_user not in ('authenticated', 'anon') then return coalesce(new, old); end if;
  -- Any direct change to (or removal of) a posted entry: description, memo,
  -- reversal links and every other column included.
  if old.posted then
    raise exception 'A posted journal entry cannot be changed or removed; reverse it instead' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public.guard_posted_journal_entry() from public, anon, authenticated;
