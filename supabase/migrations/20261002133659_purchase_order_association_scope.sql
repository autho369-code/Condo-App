-- save/submit/cancel_purchase_order only checked finance permission for the
-- portfolio. They are SECURITY DEFINER, so a finance user assigned to some
-- associations could create (and auto-approve) or cancel purchase orders for
-- associations they don't manage. Require can_manage_association too, as
-- bill_purchase_order already does.
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.save_purchase_order(uuid,uuid,uuid,uuid,uuid,text,text,date,text,jsonb,boolean)'::regprocedure) into v_def;
  v_new := replace(v_def,
    'if p_portfolio_id is null or not public.can_manage_finance(p_portfolio_id) then',
    'if p_portfolio_id is null or not public.can_manage_finance(p_portfolio_id)
     or (p_association_id is not null and not public.can_manage_association(p_association_id))
     or (p_purchase_order_id is not null and exists (
           select 1 from public.purchase_orders po
            where po.id = p_purchase_order_id and po.association_id is not null
              and not public.can_manage_association(po.association_id))) then');
  if v_new = v_def then raise exception 'save_purchase_order did not match the expected permission check'; end if;
  execute v_new;

  foreach v_def in array array[
    pg_get_functiondef('public.submit_purchase_order(uuid)'::regprocedure),
    pg_get_functiondef('public.cancel_purchase_order(uuid,text)'::regprocedure)
  ] loop
    v_new := replace(v_def,
      'if not public.can_manage_finance(po_row.portfolio_id) then raise exception ''Permission denied''; end if;',
      'if not public.can_manage_finance(po_row.portfolio_id)
     or (po_row.association_id is not null and not public.can_manage_association(po_row.association_id)) then
    raise exception ''Permission denied'';
  end if;');
    if v_new = v_def then raise exception 'purchase order function did not match the expected permission check'; end if;
    execute v_new;
  end loop;
end $$;
