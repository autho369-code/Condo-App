-- Posted journal entries are permanent. Row-level security lets finance staff
-- write journal_entries/journal_lines directly through the API (drafts are
-- built that way), so a posted entry could be unposted, re-dated, edited or
-- removed with no audit trail. Direct API writes may now only touch drafts;
-- a posted entry is corrected with a reversing entry (reverse_journal_entry).
-- Database functions (which run as their owner) keep working as before.
create or replace function public.guard_posted_journal_entry()
returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $$
begin
  if current_user not in ('authenticated', 'anon') then return coalesce(new, old); end if;
  if tg_op = 'DELETE' and old.posted then
    raise exception 'A posted journal entry cannot be removed; reverse it instead' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.posted and (new.posted is distinct from old.posted or new.entry_date is distinct from old.entry_date
       or new.portfolio_id is distinct from old.portfolio_id or new.source_type is distinct from old.source_type
       or new.source_id is distinct from old.source_id) then
    raise exception 'A posted journal entry cannot be changed; reverse it instead' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public.guard_posted_journal_entry() from public, anon, authenticated;

create or replace trigger trg_guard_posted_journal_entry before update or delete on public.journal_entries
  for each row execute function public.guard_posted_journal_entry();

create or replace function public.guard_posted_journal_lines()
returns trigger language plpgsql set search_path to 'pg_catalog', 'public' as $$
begin
  if current_user not in ('authenticated', 'anon') then return coalesce(new, old); end if;
  if exists (select 1 from public.journal_entries je
              where je.posted and je.id in (case when tg_op <> 'INSERT' then old.entry_id end, case when tg_op <> 'DELETE' then new.entry_id end)) then
    raise exception 'Lines of a posted journal entry cannot be changed; reverse the entry instead' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public.guard_posted_journal_lines() from public, anon, authenticated;

create or replace trigger trg_guard_posted_journal_lines before insert or update or delete on public.journal_lines
  for each row execute function public.guard_posted_journal_lines();
