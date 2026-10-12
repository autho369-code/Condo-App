-- Follow-ups to 20261012120000 (migration-reviewer on #333).
--
-- 1. A scoped manager could delete an unposted entry that also has lines in
--    another association; journal_lines cascade on delete, so the other
--    association's lines went with it. Deleting an entry now needs every
--    line to be in the caller's scope.
-- 2. recurring_journal_entries compared template association ids as uuid;
--    one malformed id would make every read by a scoped manager fail.
--    Compare as text.
-- 3. The helpers return nothing for callers who are not scoped managers.

create or replace function rls_private.my_hidden_journal_entry_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if (select public.manager_is_scoped()) is not true then
    return;
  end if;
  -- Entries of the caller's company whose every line is in an association
  -- the scoped manager is not assigned to.
  return query
  select je.id
    from public.journal_entries je
   where je.portfolio_id = (select public.my_access_portfolio())
     and exists (select 1 from public.journal_lines l where l.entry_id = je.id)
     and not exists (
       select 1 from public.journal_lines l
        where l.entry_id = je.id
          and (l.association_id is null
               or l.association_id in (select public.my_managed_association_ids())));
end
$$;

create or replace function rls_private.my_partly_foreign_journal_entry_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if (select public.manager_is_scoped()) is not true then
    return;
  end if;
  -- Entries of the caller's company with at least one line in an association
  -- the scoped manager is not assigned to.
  return query
  select distinct l.entry_id
    from public.journal_lines l
    join public.journal_entries je on je.id = l.entry_id
   where je.portfolio_id = (select public.my_access_portfolio())
     and l.association_id is not null
     and l.association_id not in (select public.my_managed_association_ids());
end
$$;

revoke all on function rls_private.my_partly_foreign_journal_entry_ids() from public, anon;
grant execute on function rls_private.my_partly_foreign_journal_entry_ids() to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'journal_entries' and policyname = 'mgr_assoc_scope_delete') then
    create policy mgr_assoc_scope_delete on public.journal_entries as restrictive for delete to authenticated
      using (((select public.manager_is_scoped()) is not true)
             or id not in (select rls_private.my_partly_foreign_journal_entry_ids()));
  end if;
end
$$;

alter policy mgr_assoc_scope on public.recurring_journal_entries
  using (((select public.manager_is_scoped()) is not true)
         or not exists (
           select 1
             from jsonb_array_elements(case when jsonb_typeof(template_lines) = 'array' then template_lines else '[]'::jsonb end) l
            where nullif(l ->> 'association_id', '') is not null
              and (l ->> 'association_id') not in (select x::text from public.my_managed_association_ids() x)));
