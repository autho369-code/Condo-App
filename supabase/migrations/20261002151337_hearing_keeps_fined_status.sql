-- An owner's hearing request moves a violation to hearing_pending; when the
-- board upheld it, record_violation_hearing always went back to notice_sent,
-- so a violation that had already been fined lost its 'fined' status in the
-- queue, board pages and reports. Upheld now returns to 'fined' when fines
-- were assessed. A dismissal that leaves posted fines on the ledger is
-- called out in the violation history so staff credit them.
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.record_violation_hearing(uuid,text,timestamp with time zone,text)'::regprocedure) into v_def;
  v_new := replace(v_def,
    'when status = ''hearing_pending'' then ''notice_sent''::public.violation_status else status end',
    'when status = ''hearing_pending'' then (case when coalesce(fines_total, 0) > 0 then ''fined'' else ''notice_sent'' end)::public.violation_status else status end');
  v_new := replace(v_new,
    '|| case when nullif(btrim(coalesce(p_notes, '''')), '''') is not null then ''. '' || btrim(p_notes) else '''' end,',
    '|| case when nullif(btrim(coalesce(p_notes, '''')), '''') is not null then ''. '' || btrim(p_notes) else '''' end
      || case when p_decision = ''dismissed'' and coalesce(v.fines_total, 0) > 0
              then ''. Fines already posted ($'' || to_char(v.fines_total, ''FM999,999,990.00'') || '') remain on the owner ledger: credit them if the dismissal reverses them.''
              else '''' end,');
  if (length(v_new) - length(replace(v_new, 'fines_total', ''))) / length('fines_total') <> 3 then
    raise exception 'record_violation_hearing did not match the expected definition';
  end if;
  execute v_new;
end $$;
