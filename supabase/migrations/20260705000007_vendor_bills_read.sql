-- Vendors can see the status of THEIR OWN bills ("when do I get paid?").
-- SELECT-only; approval and payment remain staff/finance actions.

drop policy if exists payable_bills_vendor_read on public.payable_bills;
create policy payable_bills_vendor_read on public.payable_bills
  for select to authenticated
  using (vendor_id = current_vendor_id());
