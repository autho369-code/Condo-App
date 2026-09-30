-- Review fixes: strict CSV value parsing so input mistakes become row errors
-- instead of different accounting values.
-- * Amounts must look like 1234.56, 1,234.56 or $1,234.56 — "12,34" or
--   "1 0.00" are rejected (previously separators were stripped: 1234 / 100).
-- * Dates must be YYYY-MM-DD — "01/02/2026" is rejected rather than read
--   according to the server DateStyle.
create or replace function public.csv_money(p text)
returns numeric language plpgsql immutable set search_path = pg_catalog as $$
declare v text := btrim(coalesce(p, ''));
begin
  if v = '' then return null; end if;
  if v !~ '^\$?([0-9]{1,3}(,[0-9]{3})+|[0-9]+)(\.[0-9]+)?$' then
    raise exception 'invalid amount "%"', v using errcode = '22023';
  end if;
  return replace(replace(v, '$', ''), ',', '')::numeric;
end $$;

create or replace function public.csv_date(p text)
returns date language plpgsql immutable set search_path = pg_catalog as $$
declare v text := btrim(coalesce(p, ''));
begin
  if v = '' then return null; end if;
  if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid date "%"', v using errcode = '22023'; end if;
  return v::date;
end $$;

do $$
declare v_def text; pairs text[][]; i int;
begin
  select pg_get_functiondef('public.import_journal_entry_batch(text, jsonb)'::regprocedure) into v_def;
  pairs := array[
    array['coalesce(nullif(regexp_replace(coalesce(r->>''debit'', ''''), ''[$,\s]'', '''', ''g''), '''')::numeric, 0)', 'coalesce(public.csv_money(r->>''debit''), 0)'],
    array['coalesce(nullif(regexp_replace(coalesce(r->>''credit'', ''''), ''[$,\s]'', '''', ''g''), '''')::numeric, 0)', 'coalesce(public.csv_money(r->>''credit''), 0)'],
    array['v_date := (r->>''date'')::date;', 'v_date := public.csv_date(r->>''date'');']];
  for i in 1 .. array_length(pairs, 1) loop
    if position(pairs[i][1] in v_def) = 0 then raise exception 'JE pattern % not found', i; end if;
    v_def := replace(v_def, pairs[i][1], pairs[i][2]);
  end loop;
  execute v_def;

  select pg_get_functiondef('public.import_bills(jsonb)'::regprocedure) into v_def;
  pairs := array[
    array['v_bill_date := (r->>''bill_date'')::date;', 'v_bill_date := public.csv_date(r->>''bill_date'');'],
    array['v_due := nullif(btrim(coalesce(r->>''due_date'', '''')), '''')::date;', 'v_due := public.csv_date(r->>''due_date'');'],
    array['v_amount := nullif(regexp_replace(coalesce(r->>''amount'', ''''), ''[$,\s]'', '''', ''g''), '''')::numeric;', 'v_amount := public.csv_money(r->>''amount'');']];
  for i in 1 .. array_length(pairs, 1) loop
    if position(pairs[i][1] in v_def) = 0 then raise exception 'bill pattern % not found', i; end if;
    v_def := replace(v_def, pairs[i][1], pairs[i][2]);
  end loop;
  execute v_def;
end $$;
