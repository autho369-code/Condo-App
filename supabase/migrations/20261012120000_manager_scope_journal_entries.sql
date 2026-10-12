-- Manager scope on journal entry headers and recurring journal entries.
--
-- journal_lines carry mgr_assoc_scope (association_id), but the headers in
-- journal_entries (memo, description, reference) and recurring_journal_entries
-- (name, memo, template lines with amounts) have no association column, so a
-- manager assigned to some associations could still read and change other
-- associations' entries company-wide.
--
-- journal_entries: hidden from a scoped manager when the entry has lines and
-- none of them is visible to them (every line belongs to an association they
-- are not assigned to). Entries with a company-level line (no association) or
-- no lines yet stay visible. A policy on journal_entries cannot read
-- journal_lines under RLS (journal_lines' finance policy reads journal_entries:
-- recursion), so the hidden set comes from a definer helper that runs once
-- per query, and only when the caller is scoped (OR short-circuits on the
-- once-per-query manager_is_scoped()).
--
-- recurring_journal_entries: visible when every template line names no
-- association or one of the caller's (same rule as app_recurring_je_in_scope,
-- inline so it does not run a function per row).
--
-- Unscoped callers pass the first branch. No manager was scoped on
-- production yet.

create or replace function rls_private.my_hidden_journal_entry_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
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

revoke all on function rls_private.my_hidden_journal_entry_ids() from public, anon;
grant execute on function rls_private.my_hidden_journal_entry_ids() to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'journal_entries' and policyname = 'mgr_assoc_scope') then
    create policy mgr_assoc_scope on public.journal_entries as restrictive for all to authenticated
      using (((select public.manager_is_scoped()) is not true)
             or id not in (select rls_private.my_hidden_journal_entry_ids()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'recurring_journal_entries' and policyname = 'mgr_assoc_scope') then
    create policy mgr_assoc_scope on public.recurring_journal_entries as restrictive for all to authenticated
      using (((select public.manager_is_scoped()) is not true)
             or not exists (
               select 1
                 from jsonb_array_elements(case when jsonb_typeof(template_lines) = 'array' then template_lines else '[]'::jsonb end) l
                where nullif(l ->> 'association_id', '') is not null
                  and (l ->> 'association_id')::uuid not in (select public.my_managed_association_ids())));
  end if;
end
$$;
