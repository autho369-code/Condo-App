-- Purchase order -> bill matching.
-- purchase_orders already had po_billed and a 'billed' status, but nothing set
-- them: a bill could not be tied to the PO it pays, so over-billing a PO went
-- unnoticed and POs never showed as billed.
--
--  * payable_bills.purchase_order_id links a bill to its PO (no FK on purpose:
--    a second bills<->POs path could make PostgREST embeds ambiguous; the
--    guard trigger validates it instead).
--  * A linked bill must match the PO's company, association and vendor, the PO
--    must be approved and not cancelled, and live bills (not void, not
--    archived) can never add up to more than the PO total.
--  * po_billed and the billed / approved status follow the linked bills.
--  * bill_purchase_order() creates the bill from the PO through the normal
--    create_payable_bill path (board approval rules included).

alter table public.payable_bills add column if not exists purchase_order_id uuid;
create index if not exists payable_bills_purchase_order_idx on public.payable_bills (purchase_order_id) where purchase_order_id is not null;

create or replace function public.payable_bills_po_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  po public.purchase_orders;
  v_other numeric;
  v_live boolean := new.status::text <> 'void' and new.archived_at is null;
begin
  if new.purchase_order_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.purchase_order_id is not distinct from old.purchase_order_id
     and new.amount is not distinct from old.amount and new.status is not distinct from old.status
     and new.archived_at is not distinct from old.archived_at
     and new.vendor_id is not distinct from old.vendor_id and new.association_id is not distinct from old.association_id then
    return new;
  end if;
  select * into po from public.purchase_orders where id = new.purchase_order_id for update;
  if po.id is null then
    raise exception 'Purchase order not found' using errcode = '23503';
  end if;
  if po.portfolio_id <> new.portfolio_id or po.association_id is distinct from new.association_id or po.vendor_id is distinct from new.vendor_id then
    raise exception 'The bill''s association and vendor must match purchase order %', po.number using errcode = '22023';
  end if;
  if v_live and (tg_op = 'INSERT' or new.purchase_order_id is distinct from old.purchase_order_id) then
    if po.status::text = 'cancelled' or po.approval_status <> 'approved' then
      raise exception 'Purchase order % is not approved (or was cancelled) — it can''t be billed', po.number using errcode = '22023';
    end if;
  end if;
  if v_live then
    select coalesce(sum(b.amount), 0) into v_other
      from public.payable_bills b
     where b.purchase_order_id = po.id and b.id <> new.id and b.status::text <> 'void' and b.archived_at is null;
    if v_other + new.amount > po.po_total then
      raise exception 'Bills on purchase order % would total $% — more than the PO''s $% (remaining $%)',
        po.number, to_char(v_other + new.amount, 'FM999,999,990.00'), to_char(po.po_total, 'FM999,999,990.00'),
        to_char(greatest(po.po_total - v_other, 0), 'FM999,999,990.00') using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_payable_bills_000_po_guard on public.payable_bills;
create trigger trg_payable_bills_000_po_guard before insert or update on public.payable_bills
  for each row execute function public.payable_bills_po_guard();

create or replace function public.purchase_order_refresh_billed(p_po_id uuid)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_billed numeric;
begin
  if p_po_id is null then
    return;
  end if;
  select coalesce(sum(b.amount), 0) into v_billed
    from public.payable_bills b
   where b.purchase_order_id = p_po_id and b.status::text <> 'void' and b.archived_at is null;
  update public.purchase_orders
     set po_billed = v_billed,
         status = case
           when status::text = 'cancelled' then status
           when po_total > 0 and v_billed >= po_total then 'billed'::public.purchase_order_status
           when status::text = 'billed' then 'approved'::public.purchase_order_status
           else status end,
         updated_at = now()
   where id = p_po_id;
end $$;
revoke all on function public.purchase_order_refresh_billed(uuid) from public, anon, authenticated;

create or replace function public.payable_bills_po_sync()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  -- AFTER trigger: the refresh sees this row's new state.
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.purchase_order_refresh_billed(old.purchase_order_id);
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.purchase_order_id is distinct from old.purchase_order_id) then
    perform public.purchase_order_refresh_billed(new.purchase_order_id);
  end if;
  return null;
end $$;
drop trigger if exists trg_payable_bills_po_sync on public.payable_bills;
create trigger trg_payable_bills_po_sync after insert or update of purchase_order_id, amount, status, archived_at or delete on public.payable_bills
  for each row execute function public.payable_bills_po_sync();

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

  -- One GL per bill: use the PO's single line account, or the one chosen.
  select count(distinct l.gl_account_id), min(l.gl_account_id::text)::uuid into v_gl_count, v_gl
    from public.purchase_order_line_items l where l.purchase_order_id = po.id and l.gl_account_id is not null;
  if p_gl_account_id is not null then
    if not exists (select 1 from public.purchase_order_line_items l where l.purchase_order_id = po.id and l.gl_account_id = p_gl_account_id) then
      raise exception 'Choose one of the purchase order''s GL accounts' using errcode = '22023';
    end if;
    v_gl := p_gl_account_id;
  elsif v_gl_count > 1 then
    raise exception 'This purchase order uses several GL accounts — choose which one this bill goes to' using errcode = '22023';
  end if;

  v_bill := public.create_payable_bill(po.portfolio_id, po.vendor_id, po.association_id, v_gl, null,
    p_bill_number, coalesce(p_bill_date, current_date), p_due_date, v_amount,
    coalesce(nullif(btrim(coalesce(p_memo, '')), ''), 'PO ' || coalesce(po.number, left(po.id::text, 8))), false, false);
  -- Linking runs the guard: approved PO, matching vendor/association, within the PO total.
  update public.payable_bills set purchase_order_id = po.id where id = v_bill;
  if coalesce(p_submit_for_approval, false) then
    perform public.request_payable_bill_approval(v_bill);
  end if;
  return v_bill;
end $$;
revoke all on function public.bill_purchase_order(uuid, text, date, date, numeric, uuid, text, boolean) from public, anon;
grant execute on function public.bill_purchase_order(uuid, text, date, date, numeric, uuid, text, boolean) to authenticated;
