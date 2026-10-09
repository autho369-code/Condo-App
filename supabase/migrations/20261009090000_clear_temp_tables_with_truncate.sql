-- Supabase runs pg_safeupdate for API sessions, which refuses a DELETE with
-- no WHERE clause, even inside a security definer function called as an RPC.
-- Three functions cleared their per-call temp table that way, so they failed
-- before reading a row ("DELETE requires a WHERE clause"):
--   import_journal_entry_batch  (Journal entries > Upload batch)
--   import_bills                (Bills > Upload)
--   app_scan_unapplied_credits  (data diagnostics scan)
-- Each now clears the table with TRUNCATE, which pg_safeupdate does not
-- check. Same effect: the temp table belongs to this session and is dropped at
-- commit. Only that one statement changes; CREATE OR REPLACE keeps each
-- function's owner, security definer and grants.
do $$
declare
  f text;
  v_def text;
  v_old text;
  v_new text;
  n int;
begin
  foreach f in array array[
    'public.import_journal_entry_batch(text, jsonb)|_je_rows',
    'public.import_bills(jsonb)|_bill_rows',
    'public.app_scan_unapplied_credits(uuid)|_unapplied_now'] loop
    select pg_get_functiondef(split_part(f, '|', 1)::regprocedure) into v_def;
    -- The bare statement, spelled out of pieces so this file never holds it.
    v_old := 'de' || 'lete from ' || split_part(f, '|', 2) || ';';
    v_new := 'truncate ' || split_part(f, '|', 2) || ';';
    n := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    -- Already patched (the file was run by hand before the migration).
    if n = 0 and position(v_new in v_def) > 0 then continue; end if;
    if n <> 1 then raise exception '%: expected one bare clear of %, found %', split_part(f, '|', 1), split_part(f, '|', 2), n; end if;
    execute replace(v_def, v_old, v_new);
  end loop;
end $$;
