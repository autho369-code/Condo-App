-- submit_vendor_invoice accepted invoices for any assigned work order, even
-- new or cancelled ones, and never linked the work order's purchase order, so
-- the PO over-billing guard (payable_bills_po_guard) never applied to vendor
-- invoices. Invoices now need a finished job, and link the job's single
-- approved purchase order for this vendor so the guard enforces its remaining
-- amount.
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.submit_vendor_invoice(uuid,text,date,date,numeric,text,text,text)'::regprocedure) into v_def;
  v_new := replace(v_def,
    '  v_file_name text := trim(p_file_name);
begin',
    '  v_file_name text := trim(p_file_name);
  v_status text;
  v_po_id uuid;
  v_po_count integer;
begin');
  v_new := replace(v_new,
    '  select wo.portfolio_id, wo.association_id
    into v_portfolio_id, v_association_id',
    '  select wo.portfolio_id, wo.association_id, wo.status::text
    into v_portfolio_id, v_association_id, v_status');
  v_new := replace(v_new,
    '  if v_bill_number = '''' or char_length(v_bill_number) > 100 then',
    '  if v_status not in (''done'', ''completed'', ''billed'', ''closed'') then
    raise exception ''Mark the job done before sending an invoice'';
  end if;
  select count(*), min(po.id::text)::uuid into v_po_count, v_po_id
    from public.purchase_orders po
   where po.work_order_id = p_work_order_id
     and po.vendor_id = v_vendor_id
     and po.approval_status = ''approved''
     and po.cancelled_at is null
     and po.archived_at is null;
  if v_po_count <> 1 then v_po_id := null; end if;
  if v_bill_number = '''' or char_length(v_bill_number) > 100 then');
  v_new := replace(v_new,
    '    id, portfolio_id, vendor_id, association_id, work_order_id,
    bill_number,',
    '    id, portfolio_id, vendor_id, association_id, work_order_id, purchase_order_id,
    bill_number,');
  v_new := replace(v_new,
    '    v_bill_id, v_portfolio_id, v_vendor_id, v_association_id, p_work_order_id,
    v_bill_number,',
    '    v_bill_id, v_portfolio_id, v_vendor_id, v_association_id, p_work_order_id, v_po_id,
    v_bill_number,');
  if (length(v_new) - length(replace(v_new, 'v_po_id', ''))) / length('v_po_id') <> 4
     or position('v_status not in' in v_new) = 0
     or position('into v_portfolio_id, v_association_id, v_status' in v_new) = 0
     or position('work_order_id, purchase_order_id,' in v_new) = 0
     or position('v_po_count integer;' in v_new) = 0 then
    raise exception 'submit_vendor_invoice did not match the expected definition';
  end if;
  execute v_new;
end $$;
