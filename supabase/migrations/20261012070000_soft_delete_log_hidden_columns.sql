-- The deleted-records log no longer copies columns signed-in users may not
-- read.
--
-- log_soft_delete (a SECURITY DEFINER trigger on bank_accounts and 22 other
-- tables) stored the whole archived row in soft_delete_log.prior_state, and
-- soft_delete_log_admin_read lets full-access staff read the company's log.
-- So archiving a bank account would have shown its full routing and account
-- numbers, which are hidden from signed-in users (only the *_last4 columns
-- are granted, 20261003160000). Checked on production 2026-10-12: no
-- bank_accounts row has been logged yet (the log holds associations and
-- form_templates only), so there is nothing to clean up.
--
-- prior_state now leaves out every column the authenticated role cannot
-- SELECT, so a column hidden later is covered too. Same behaviour otherwise.

create or replace function public.log_soft_delete()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  resolved_portfolio_id uuid;
  prior jsonb;
  hidden text;
begin
  if new.archived_at is not null and (old.archived_at is null or old.archived_at is distinct from new.archived_at) then
    -- Try to pick the portfolio_id off the row directly; otherwise leave null
    begin
      execute format('select ($1::%I).portfolio_id', tg_relid::regclass::text)
        into resolved_portfolio_id using new;
    exception when others then
      resolved_portfolio_id := null;
    end;

    -- Columns hidden from signed-in users stay out of the log.
    prior := to_jsonb(old);
    for hidden in
      select a.attname
        from pg_attribute a
       where a.attrelid = tg_relid
         and a.attnum > 0
         and not a.attisdropped
         and not has_column_privilege('authenticated', tg_relid, a.attnum, 'SELECT')
    loop
      prior := prior - hidden;
    end loop;

    insert into public.soft_delete_log (
      portfolio_id, entity_type, entity_id, archived_by, prior_state
    ) values (
      resolved_portfolio_id,
      tg_table_name,
      (row_to_json(new)->>'id')::uuid,
      auth.uid(),
      prior
    );
  end if;
  return new;
end;
$function$;
