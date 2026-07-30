-- See supabase/migrations/20260705000007_vendor_bills_read.sql
drop policy if exists payable_bills_vendor_read on public.payable_bills;
create policy payable_bills_vendor_read on public.payable_bills
  for select to authenticated
  using (vendor_id = current_vendor_id());;
