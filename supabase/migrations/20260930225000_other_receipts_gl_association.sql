-- #83 review fix (P1): record_other_receipt accepted a GL account that belongs
-- to a different association in the same company, tagging association A's
-- journal line with association B's account. A line's GL must now be
-- company-wide (association_id null) or belong to the receipt's association.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.record_other_receipt(uuid, uuid, date, text, uuid, text, text, text, jsonb)'::regprocedure);
  if position('and portfolio_id = v_portfolio and coalesce(active, true);' in def) = 0 then
    raise exception 'other_receipts_gl_association: record_other_receipt drifted';
  end if;
  def := replace(def, 'and portfolio_id = v_portfolio and coalesce(active, true);',
    'and portfolio_id = v_portfolio and coalesce(active, true)' || chr(10) ||
    '       and (association_id is null or association_id = p_association_id);');
  execute def;
end $$;
