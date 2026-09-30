-- Association-scoped property managers (association_managers): the RPCs added
-- in this program checked can_access_association(), which only verifies the
-- portfolio. They now use can_manage_association(), which also honours a
-- manager's assigned associations, so a scoped manager cannot post credits,
-- recurring bills, fees, imports or collection changes for associations they
-- are not assigned to. (No manager is association-scoped in production yet.)
do $$
declare f text; v_def text; n int;
begin
  foreach f in array array[
    'public.add_occupancy_delinquency_note(uuid, text)',
    'public.import_bills(jsonb)',
    'public.import_journal_entry_batch(text, jsonb)',
    'public.management_fee_preview(date)',
    'public.post_homeowner_credit(uuid, numeric, date, uuid, text, uuid)',
    'public.save_recurring_bill(uuid, uuid, uuid, uuid, uuid, text, text, numeric, text, integer, date, date, integer, boolean)',
    'public.save_recurring_journal_entry(uuid, text, text, text, integer, date, jsonb, boolean)',
    'public.set_occupancy_collection_status(uuid, boolean, boolean, boolean, boolean, boolean)',
    'public.set_occupancy_dues_reminders(uuid, boolean)'] loop
    select pg_get_functiondef(f::regprocedure) into v_def;
    n := (length(v_def) - length(replace(v_def, 'public.can_access_association(', ''))) / length('public.can_access_association(');
    if n = 0 then raise exception '% has no can_access_association call', f; end if;
    execute replace(v_def, 'public.can_access_association(', 'public.can_manage_association(');
  end loop;
end $$;
