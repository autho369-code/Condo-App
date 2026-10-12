-- Receivables > Bank Deposits: receipts grouped by date and bank account in
-- the database.
--
-- The tab used to load every receipt ever recorded (paged, up to 50,000)
-- into the server and group it there; past that it showed "Too many
-- receipts to group". This returns one row per (payment date, bank account)
-- with the receipt count and total, using the same rows the page used:
-- receivable_payments_ledger without homeowner credits (method 'credit'),
-- in the association / owner's units when given.
--
-- Runs as the caller (row-level security applies through the
-- security_invoker view); plans are reused per connection.

create or replace function public.receipt_deposit_groups(
  p_association_id uuid default null,
  p_unit_ids uuid[] default null
)
returns table (
  payment_date date,
  bank_account_id uuid,
  bank_account_name text,
  bank_name text,
  receipt_count bigint,
  total numeric
)
language plpgsql
stable
set search_path to 'public'
set plan_cache_mode = force_generic_plan
as $function$
begin
  return query
  select l.payment_date,
         l.bank_account_id,
         min(l.bank_account_name),
         min(l.bank_name),
         count(*),
         coalesce(sum(l.amount), 0)
    from public.receivable_payments_ledger l
   where (l.method is null or l.method <> 'credit')
     and (p_association_id is null or l.association_id = p_association_id)
     and (p_unit_ids is null or l.unit_id = any (p_unit_ids))
   group by l.payment_date, l.bank_account_id;
end
$function$;

revoke all on function public.receipt_deposit_groups(uuid, uuid[]) from public, anon;
grant execute on function public.receipt_deposit_groups(uuid, uuid[]) to authenticated;
