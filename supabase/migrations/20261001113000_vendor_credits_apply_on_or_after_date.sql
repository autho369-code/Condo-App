-- A vendor credit can be applied to bills only on or after its credit date. A future-dated
-- credit hasn't reduced A/P in the ledger yet, so applying it early would let a bill be marked
-- paid (and drop out of A/P aging) before the accounting effect exists.

do $$
declare
  v_fn regprocedure := 'public.apply_vendor_credit(uuid, uuid, numeric)';
  v_def text := pg_get_functiondef(v_fn);
  v_anchor text := 'raise exception ''Credit not found'' using errcode = ''42501'';' || chr(10) || '  end if;';
begin
  if position(v_anchor in v_def) = 0 then
    raise exception 'vendor_credits_apply_on_or_after_date: apply_vendor_credit drifted';
  end if;
  execute replace(v_def, v_anchor, v_anchor || chr(10) ||
    '  if c.credit_date > current_date then' || chr(10) ||
    '    raise exception ''This credit is dated %; it can be applied on or after that date'', c.credit_date using errcode = ''22023'';' || chr(10) ||
    '  end if;');
end $$;
