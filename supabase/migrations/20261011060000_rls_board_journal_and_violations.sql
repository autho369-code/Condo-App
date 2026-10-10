-- Speed, the last per-row policy helpers on tables that grow
-- (Status "Next gaps" 3).
--
-- 1. journal_entries_board_read called journal_entry_touches_board_associations(id)
--    for every journal entry: one journal_lines lookup per entry, the
--    fastest-growing table. It now compares id with a once-per-query set
--    of the entries that touch the board member's associations. Same
--    meaning: the original is exists(line of this entry in a board
--    association); the set is every such entry id.
-- 2. can_manage_violations(x) has exactly the body of can_manage_association(x),
--    so its six policies use the same once-per-query twin,
--    my_manageable_association_ids().
--
-- The other per-row helpers left (resident move-in date, meetings,
-- budgets, signatures, notices, bank transfers, import locks) run only on
-- rows already narrowed to the caller's own units/records, or on small
-- tables.

create or replace function rls_private.my_board_journal_entry_ids()
returns setof uuid
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  -- Entries journal_entry_touches_board_associations() is true for.
  return query
  select distinct jl.entry_id
    from public.journal_lines jl
   where jl.association_id in (select public.current_board_association_ids())
     and jl.entry_id is not null;
end
$$;

revoke all on function rls_private.my_board_journal_entry_ids() from public, anon;
grant execute on function rls_private.my_board_journal_entry_ids() to authenticated, service_role;

alter policy journal_entries_board_read on public.journal_entries
  using (( select public.is_board_user() as is_board_user)
         and id in ( select rls_private.my_board_journal_entry_ids() as my_board_journal_entry_ids));

alter policy violation_letters_staff_insert on public.violation_letters
  with check (coalesce((association_id in ( select public.my_manageable_association_ids() as my_manageable_association_ids)), false));
alter policy violation_letters_staff_read on public.violation_letters
  using (coalesce((association_id in ( select public.my_manageable_association_ids() as my_manageable_association_ids)), false));
alter policy violation_letters_staff_update on public.violation_letters
  using (coalesce((association_id in ( select public.my_manageable_association_ids() as my_manageable_association_ids)), false))
  with check (coalesce((association_id in ( select public.my_manageable_association_ids() as my_manageable_association_ids)), false));
alter policy violation_followup_steps_staff_read on public.violation_followup_steps
  using (coalesce((association_id in ( select public.my_manageable_association_ids() as my_manageable_association_ids)), false));
alter policy association_violation_settings_staff_read on public.association_violation_settings
  using (coalesce((association_id in ( select public.my_manageable_association_ids() as my_manageable_association_ids)), false));
alter policy violation_fines_staff_read on public.violation_fines
  using (exists ( select 1 from public.violations v
                   where v.id = violation_fines.violation_id
                     and coalesce((v.association_id in ( select public.my_manageable_association_ids() as my_manageable_association_ids)), false)));

comment on function public.journal_entry_touches_board_associations(uuid) is
  'Policies use the twin: id IN (select rls_private.my_board_journal_entry_ids()). Change both together (20261011060000).';
comment on function public.can_manage_violations(uuid) is
  'Same body as can_manage_association; policies use x IN (select my_manageable_association_ids()). Change all together (20261011060000).';
