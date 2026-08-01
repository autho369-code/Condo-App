-- A draft must be explicitly submitted before finance staff can approve it.
-- Keep approved in the accepted set so approval remains safely idempotent.
create or replace function public.approve_payable_bill(p_bill_id uuid)
returns uuid
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  entry_id uuid;
  bill_row public.payable_bills;
  request_status public.approval_request_status;
begin
  select * into bill_row from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if not public.can_manage_finance(bill_row.portfolio_id) then raise exception 'Permission denied'; end if;
  if bill_row.status not in ('pending_approval'::public.payable_bill_status, 'approved'::public.payable_bill_status) then
    raise exception 'Only submitted, unpaid bills can be approved';
  end if;
  if bill_row.approval_required then
    if bill_row.approval_request_id is null then raise exception 'Board approval has not been requested'; end if;
    select status into request_status from public.approval_requests
     where id = bill_row.approval_request_id
       and portfolio_id = bill_row.portfolio_id
       and association_id = bill_row.association_id;
    if request_status is distinct from 'approved'::public.approval_request_status then
      raise exception 'Board approval is not complete';
    end if;
  end if;
  update public.payable_bills
     set status = 'approved'::public.payable_bill_status,
         approved_at = coalesce(approved_at, now()),
         approved_by = coalesce(approved_by, auth.uid()),
         updated_at = now()
   where id = p_bill_id;
  entry_id := public.ensure_payable_bill_accrual(p_bill_id);
  return entry_id;
end;
$$;

alter function public.approve_payable_bill(uuid) owner to postgres;
revoke all on function public.approve_payable_bill(uuid) from public, anon;
grant execute on function public.approve_payable_bill(uuid) to authenticated, service_role;
