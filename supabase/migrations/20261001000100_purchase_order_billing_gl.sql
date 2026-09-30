-- #90 review fix: bill_purchase_order inferred the bill's GL account from the
-- PO lines that HAVE one, ignoring uncategorized lines — so a PO with a mix
-- would post the uncategorized share to the wrong account, and a PO with only
-- uncategorized lines produced a bill with no account. The account is now
-- inferred only when every line uses the same one; otherwise staff must choose
-- it (any active account of the PO's company that the association can use).
create or replace function public.bill_purchase_order(
  p_po_id uuid,
  p_bill_number text,
  p_bill_date date,
  p_due_date date,
  p_amount numeric,
  p_gl_account_id uuid,
  p_memo text,
  p_submit_for_approval boolean
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  po public.purchase_orders;
  v_gl uuid;
  v_gl_count integer;
  v_uncategorized integer;
  v_amount numeric := round(p_amount, 2);
  v_bill uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to bill purchase orders' using errcode = '42501';
  end if;
  select * into po from public.purchase_orders where id = p_po_id and archived_at is null;
  if po.id is null then
    raise exception 'Purchase order not found';
  end if;
  if not ((public.can_manage_finance(po.portfolio_id) and (po.association_id is null or public.can_manage_association(po.association_id)))
          or public.is_platform_operator()) then
    raise exception 'You do not have accounting access to this purchase order' using errcode = '42501';
  end if;
  if po.vendor_id is null then
    raise exception 'Add a vendor to the purchase order before billing it' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Enter the bill amount' using errcode = '22023';
  end if;

  select count(distinct l.gl_account_id), min(l.gl_account_id::text)::uuid, count(*) filter (where l.gl_account_id is null)
    into v_gl_count, v_gl, v_uncategorized
    from public.purchase_order_line_items l where l.purchase_order_id = po.id;
  if p_gl_account_id is not null then
    if not exists (select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = po.portfolio_id
                     and (g.association_id is null or g.association_id is not distinct from po.association_id)
                     and coalesce(g.active, true)) then
      raise exception 'Choose an active GL account of this association' using errcode = '22023';
    end if;
    v_gl := p_gl_account_id;
  elsif v_gl_count <> 1 or v_uncategorized > 0 then
    raise exception 'Choose the GL account for this bill — the purchase order''s lines don''t all use one account' using errcode = '22023';
  end if;

  v_bill := public.create_payable_bill(po.portfolio_id, po.vendor_id, po.association_id, v_gl, null,
    p_bill_number, coalesce(p_bill_date, current_date), p_due_date, v_amount,
    coalesce(nullif(btrim(coalesce(p_memo, '')), ''), 'PO ' || coalesce(po.number, left(po.id::text, 8))), false, false);
  update public.payable_bills set purchase_order_id = po.id where id = v_bill;
  if coalesce(p_submit_for_approval, false) then
    perform public.request_payable_bill_approval(v_bill);
  end if;
  return v_bill;
end $$;
