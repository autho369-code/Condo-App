-- Codex on #383 (P1): reallocate_payment (security definer, callable by
-- finance staff from the payment page's allocation form) deletes and
-- re-inserts a payment's applications as the function owner, so the
-- removal-credit guards don't see it. It now refuses a removed late fee's
-- credit; the page hides the allocation form for it. Re-runnable: marker,
-- anchor exactly once.
do $$
declare
  d text := replace(pg_get_functiondef('public.reallocate_payment(uuid, jsonb)'::regprocedure), chr(13), '');
  a text := E'  if pay.reversed_at is not null then\n    raise exception ''This payment was reversed and cannot be reallocated'' using errcode = ''22023'';\n  end if;\n';
begin
  if position('removed_late_fee_no_reallocation' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception 'reallocate_payment: anchor not found exactly once';
  end if;
  execute replace(d, a, a
    || E'  -- removed_late_fee_no_reallocation: a removed late fee''s credit stays on that fee.\n'
    || E'  if pay.method = ''credit'' and pay.reference = ''Late fee removed'' then\n'
    || E'    raise exception ''This credit removed a late fee and stays applied to it'' using errcode = ''22023'';\n'
    || E'  end if;\n');
end $$;
