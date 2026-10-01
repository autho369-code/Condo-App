-- management_fees.collected_cents / delinquent_cents were never written, so
-- the company Revenue page, the overview metrics (v_company_metrics) and the
-- management-fee report always showed $0 collected. A management fee is billed
-- as a payable bill (bill_id) that is paid in full, so derive both from it:
--   collected  = bill amount net of credits once the bill is paid
--   delinquent = that amount while the bill is still unpaid
create or replace function public.management_fee_collection_from_bill()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
declare
  v_due integer;
begin
  if tg_table_name = 'payable_bills' then
    v_due := round((new.amount - coalesce(new.credit_applied, 0)) * 100)::int;
    update public.management_fees mf
       set collected_cents = case when new.status = 'paid' and new.archived_at is null then v_due else 0 end,
           delinquent_cents = case when new.status in ('paid', 'void') or new.archived_at is not null then 0 else v_due end
     where mf.bill_id = new.id;
    return new;
  end if;

  -- management_fees insert/update: read the linked bill's current state.
  if new.bill_id is not null then
    select case when pb.status = 'paid' and pb.archived_at is null then round((pb.amount - coalesce(pb.credit_applied, 0)) * 100)::int else 0 end,
           case when pb.status in ('paid', 'void') or pb.archived_at is not null then 0 else round((pb.amount - coalesce(pb.credit_applied, 0)) * 100)::int end
      into new.collected_cents, new.delinquent_cents
      from public.payable_bills pb
     where pb.id = new.bill_id;
    new.collected_cents := coalesce(new.collected_cents, 0);
    new.delinquent_cents := coalesce(new.delinquent_cents, 0);
  end if;
  return new;
end;
$$;

revoke all on function public.management_fee_collection_from_bill() from public, anon, authenticated;

drop trigger if exists management_fee_collection_sync on public.payable_bills;
create trigger management_fee_collection_sync
  after update of status, amount, credit_applied, archived_at on public.payable_bills
  for each row execute function public.management_fee_collection_from_bill();

drop trigger if exists management_fee_collection_from_bill on public.management_fees;
create trigger management_fee_collection_from_bill
  before insert or update of bill_id on public.management_fees
  for each row execute function public.management_fee_collection_from_bill();

-- Backfill existing fee rows from their bills.
update public.management_fees mf
   set collected_cents = case when pb.status = 'paid' and pb.archived_at is null then round((pb.amount - coalesce(pb.credit_applied, 0)) * 100)::int else 0 end,
       delinquent_cents = case when pb.status in ('paid', 'void') or pb.archived_at is not null then 0 else round((pb.amount - coalesce(pb.credit_applied, 0)) * 100)::int end
  from public.payable_bills pb
 where pb.id = mf.bill_id;
