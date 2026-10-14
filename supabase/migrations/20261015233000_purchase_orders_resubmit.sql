-- Codex on #387: a board-rejected PO resubmitted after the association's
-- rules change so it no longer needs the board was approved but still
-- pointed at its old rejected request, so the page showed that rejection as
-- the current vote. The auto-approve branch now clears approval_request_id
-- (the edit path already does); the old request stays as standalone history.
create or replace function public.submit_purchase_order(p_purchase_order_id uuid)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  po_row public.purchase_orders;
  vendor_name text;
  request_id uuid;
  line_count integer;
  v_mode text;
  v_threshold numeric;
begin
  select * into po_row from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if not public.can_manage_finance(po_row.portfolio_id)
     or (po_row.association_id is not null and not public.can_manage_association(po_row.association_id)) then
    raise exception 'Permission denied';
  end if;
  if po_row.archived_at is not null or po_row.status = 'cancelled'::public.purchase_order_status then
    raise exception 'Cancelled purchase orders cannot be submitted';
  end if;
  if po_row.approval_status not in ('draft', 'rejected') then
    raise exception 'This purchase order has already been submitted';
  end if;
  select count(*) into line_count from public.purchase_order_line_items where purchase_order_id = p_purchase_order_id;
  if line_count = 0 or po_row.po_total <= 0 then raise exception 'Add at least one priced line item before submitting'; end if;

  -- purchase_orders_fixes: the association's board rules today decide, not
  -- the rules when the draft was saved (or generated from a recurring PO).
  select s.sends_pos_to_board, s.pos_threshold into v_mode, v_threshold
    from public.board_approval_settings s where s.association_id = po_row.association_id;
  v_mode := coalesce(v_mode, 'never');
  po_row.approval_required := v_mode = 'always' or (v_mode = 'over_threshold' and po_row.po_total >= coalesce(v_threshold, 0));
  update public.purchase_orders set approval_required = po_row.approval_required where id = p_purchase_order_id;

  if not po_row.approval_required then
    update public.purchase_orders
       set approval_status = 'approved',
           status = 'approved'::public.purchase_order_status,
           submitted_at = now(),
           approved_at = now(),
           approved_by = auth.uid(),
           decided_at = now(),
           decision_note = 'Approved within manager spending authority',
           -- purchase_orders_resubmit: a resubmitted PO that no longer needs
           -- the board drops its old (rejected) request; it stays as history.
           approval_request_id = null,
           updated_at = now()
     where id = p_purchase_order_id;
    return 'approved';
  end if;

  select name into vendor_name from public.vendors where id = po_row.vendor_id;
  request_id := public.open_board_approval_request(
    po_row.portfolio_id, po_row.association_id, po_row.vendor_id, 'purchase_order',
    'PO ' || coalesce(po_row.number, left(po_row.id::text, 8)) || ' — ' || coalesce(vendor_name, 'Vendor'),
    coalesce(po_row.description, po_row.notes), po_row.po_total, po_row.needed_by
  );
  update public.purchase_orders
     set approval_status = 'pending_approval',
         approval_request_id = request_id,
         submitted_at = now(),
         decided_at = null,
         decision_note = null,
         updated_at = now()
   where id = p_purchase_order_id;
  return 'pending_approval';
end;
$function$;
