-- BUG FIX: create_payable_bill failed for every association without a
-- board_approval_settings row (currently all of them). SELECT ... INTO with no
-- row sets board_mode to NULL (overwriting its 'never' default), so
-- requires_board became NULL and the insert hit the NOT NULL constraint on
-- approval_required — the New bill form could not save a bill.
do $$
declare v_def text; v_old text; v_new text;
begin
  select pg_get_functiondef('public.create_payable_bill(uuid, uuid, uuid, uuid, uuid, text, date, date, numeric, text, boolean, boolean)'::regprocedure) into v_def;
  v_old := 'requires_board := coalesce(p_board_approval, false)
    or board_mode = ''always''
    or (board_mode = ''over_threshold'' and p_amount >= coalesce(board_threshold, 0));';
  v_new := 'requires_board := coalesce(coalesce(p_board_approval, false)
    or coalesce(board_mode, ''never'') = ''always''
    or (board_mode = ''over_threshold'' and p_amount >= coalesce(board_threshold, 0)), false);';
  if position(v_old in v_def) = 0 then raise exception 'create_payable_bill requires_board expression not found'; end if;
  execute replace(v_def, v_old, v_new);
end $$;
