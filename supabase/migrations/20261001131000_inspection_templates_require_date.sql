-- Bulk-scheduling inspections requires a scheduled date (never create an undated batch).

do $$
declare
  v_fn regprocedure := 'public.create_inspections_from_template(uuid, uuid, uuid[], boolean, date, text, text)';
  v_def text := pg_get_functiondef(v_fn);
  v_anchor text := 'if not found then raise exception ''Template not found'' using errcode = ''P0002''; end if;';
begin
  if position(v_anchor in v_def) = 0 then
    raise exception 'inspection_templates_require_date: create_inspections_from_template drifted';
  end if;
  execute replace(v_def, v_anchor, v_anchor || chr(10) ||
    '  if p_scheduled_date is null then raise exception ''Choose the date to schedule the inspections for'' using errcode = ''22023''; end if;');
end $$;
