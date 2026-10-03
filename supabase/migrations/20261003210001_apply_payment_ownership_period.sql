-- Automatic payment application stays within one ownership period. A new
-- payment (trg_auto_apply_payment → apply_payment) went to the unit's oldest
-- open charges, so the new owner's money paid off a previous owner's unpaid
-- charges. The automatic strategies now split at the date the current owner
-- took the unit: a payment dated on or after it only pays charges due on or
-- after it, and an earlier payment only pays earlier charges. A staff-chosen
-- charge list (auto_specific) is applied as chosen.

do $$
declare def text;
begin
  def := pg_get_functiondef('public.apply_payment(uuid, text, uuid[])'::regprocedure);
  if position('  alloc_order text[];' || chr(10) || 'begin' in def) = 0
     or position('  if p_strategy = ''association_policy'' then' in def) = 0
     or (length(def) - length(replace(def, 'where c.unit_id = pay.unit_id' || chr(10) || '         and (c.amount', ''))) = 0 then
    raise exception 'apply_payment drifted';
  end if;
  def := replace(def, '  alloc_order text[];' || chr(10) || 'begin',
    '  alloc_order text[];' || chr(10) || '  v_since date;' || chr(10) || '  v_from date := ''-infinity'';' || chr(10) ||
    '  v_to date := ''infinity'';' || chr(10) || 'begin');
  def := replace(def, '  if p_strategy = ''association_policy'' then',
    '  -- One ownership period: split at the current owner''s move-in.' || chr(10) ||
    '  v_since := public.app_unit_owner_since(pay.unit_id);' || chr(10) ||
    '  if v_since is not null then' || chr(10) ||
    '    if coalesce(pay.payment_date, current_date) >= v_since then v_from := v_since; else v_to := v_since; end if;' || chr(10) ||
    '  end if;' || chr(10) || chr(10) ||
    '  if p_strategy = ''association_policy'' then');
  def := replace(def, 'where c.unit_id = pay.unit_id' || chr(10) || '         and (c.amount',
    'where c.unit_id = pay.unit_id' || chr(10) || '         and coalesce(c.due_date, c.created_at::date) >= v_from and coalesce(c.due_date, c.created_at::date) < v_to' || chr(10) || '         and (c.amount');
  execute def;
end $$;
