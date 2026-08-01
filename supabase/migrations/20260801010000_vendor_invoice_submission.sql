-- Vendors could view payment history but had no supported way to submit the
-- invoices the portal claimed they had submitted. Keep the accounting insert
-- atomic with its private document record and derive every tenant identifier
-- from the authenticated vendor's assigned work order.
create or replace function public.submit_vendor_invoice(
  p_work_order_id uuid,
  p_bill_number text,
  p_bill_date date,
  p_due_date date,
  p_amount numeric,
  p_memo text,
  p_attachment_path text,
  p_file_name text
)
returns uuid
language plpgsql
security definer
set search_path = 'pg_catalog', 'public'
as $$
declare
  v_vendor_id uuid;
  v_portfolio_id uuid;
  v_association_id uuid;
  v_bill_id uuid := gen_random_uuid();
  v_bill_number text := trim(p_bill_number);
  v_file_name text := trim(p_file_name);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_vendor_id := public.current_vendor_id();
  if v_vendor_id is null then
    raise exception 'Active vendor portal access is required';
  end if;

  select wo.portfolio_id, wo.association_id
    into v_portfolio_id, v_association_id
  from public.work_orders wo
  where wo.id = p_work_order_id
    and wo.vendor_id = v_vendor_id
    and wo.archived_at is null;

  if v_portfolio_id is null or v_association_id is null then
    raise exception 'Assigned work order not found';
  end if;
  if v_bill_number = '' or char_length(v_bill_number) > 100 then
    raise exception 'Invoice number must be 1 to 100 characters';
  end if;
  if p_amount is null or p_amount <= 0 or scale(p_amount) > 2 then
    raise exception 'Invoice amount must be positive with no more than two decimal places';
  end if;
  if p_bill_date is null then
    raise exception 'Invoice date is required';
  end if;
  if p_due_date is not null and p_due_date < p_bill_date then
    raise exception 'Due date cannot be before invoice date';
  end if;
  if p_memo is not null and char_length(p_memo) > 1000 then
    raise exception 'Memo must be 1,000 characters or fewer';
  end if;
  if v_file_name = '' or char_length(v_file_name) > 255 then
    raise exception 'Invoice file name is invalid';
  end if;
  if p_attachment_path not like 'vendors/' || v_vendor_id::text || '/invoice/%'
     or not public.document_path_matches_entity('vendor', v_vendor_id, p_attachment_path) then
    raise exception 'Invalid invoice attachment reference';
  end if;

  -- Serialize a vendor/invoice-number pair so rapid retries cannot create two
  -- accounting records even without a broad index over historical data.
  perform pg_advisory_xact_lock(hashtextextended(v_vendor_id::text || ':' || lower(v_bill_number), 0));
  if exists (
    select 1 from public.payable_bills pb
    where pb.vendor_id = v_vendor_id
      and pb.archived_at is null
      and lower(trim(pb.bill_number)) = lower(v_bill_number)
  ) then
    raise exception 'Invoice number already exists for this vendor';
  end if;

  insert into public.payable_bills (
    id, portfolio_id, vendor_id, association_id, work_order_id,
    bill_number, bill_date, due_date, occurred_on, amount, memo,
    status, approval_required, created_by
  ) values (
    v_bill_id, v_portfolio_id, v_vendor_id, v_association_id, p_work_order_id,
    v_bill_number, p_bill_date, p_due_date, p_bill_date, p_amount, nullif(trim(p_memo), ''),
    'pending_approval', true, auth.uid()
  );

  insert into public.documents (
    entity_type, entity_id, doc_type, file_name, file_url, uploaded_by
  ) values (
    'vendor', v_vendor_id, 'vendor_invoice', v_file_name, p_attachment_path, auth.uid()
  );

  return v_bill_id;
end;
$$;

revoke all on function public.submit_vendor_invoice(uuid, text, date, date, numeric, text, text, text) from public, anon;
grant execute on function public.submit_vendor_invoice(uuid, text, date, date, numeric, text, text, text) to authenticated;
