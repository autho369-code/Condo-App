-- Follow-up to 20261012130000 (migration-reviewer).
--
-- The delete rule only covered DELETE: a scoped manager could still update a
-- draft entry that has another association's lines (post it, change its date
-- or memo) through the API. Updating an entry now needs every line to be in
-- the caller's scope, like deleting it. The app's draft actions already
-- refused mixed entries.
-- Recurring template ids are compared case-insensitively (an upper-case id
-- in a template no longer hides the caller's own entry).

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'journal_entries' and policyname = 'mgr_assoc_scope_update') then
    create policy mgr_assoc_scope_update on public.journal_entries as restrictive for update to authenticated
      using (((select public.manager_is_scoped()) is not true)
             or id not in (select rls_private.my_partly_foreign_journal_entry_ids()))
      with check (((select public.manager_is_scoped()) is not true)
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
              and lower(l ->> 'association_id') not in (select x::text from public.my_managed_association_ids() x)));
