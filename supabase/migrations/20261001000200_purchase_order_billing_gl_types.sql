-- #90 review fix: a PO bill must post to an active EXPENSE account of the PO's
-- company and association, whether the account was inferred from the PO lines
-- or chosen. PO lines accept any account type, so a PO whose lines all use a
-- cash / income / liability account (or one deactivated since) now asks for
-- an expense account instead of posting there.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.bill_purchase_order(uuid, text, date, date, numeric, uuid, text, boolean)'::regprocedure);
  if def !~ 'v_bill := public\.create_payable_bill\(' then
    raise exception 'purchase_order_billing_gl_types: bill_purchase_order drifted';
  end if;
  def := regexp_replace(def, '(\s*)v_bill := public\.create_payable_bill\(',
    '\1if not exists (select 1 from public.gl_accounts g where g.id = v_gl and g.portfolio_id = po.portfolio_id' ||
    ' and (g.association_id is null or g.association_id is not distinct from po.association_id)' ||
    ' and coalesce(g.active, true) and g.account_type::text in (''expense'', ''other_expense'', ''cost_of_goods_sold'')) then' ||
    '\1  raise exception ''Choose an active expense account for this bill — the purchase order''''s account is inactive or not an expense account'' using errcode = ''22023'';' ||
    '\1end if;' ||
    '\1v_bill := public.create_payable_bill(');
  execute def;
end $$;
