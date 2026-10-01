-- Vendors could see their own bills but not the association each bill is
-- for, unless they also had a work order there, so the vendor Payments page
-- showed "—" for every bill. Let a vendor read the name of associations they
-- have bills with. The id list comes from a SECURITY DEFINER helper so this
-- policy never re-enters payable_bills RLS.
create or replace function public.current_vendor_bill_association_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct pb.association_id
  from public.payable_bills pb
  where pb.vendor_id = public.current_vendor_id()
    and pb.association_id is not null
$$;

revoke all on function public.current_vendor_bill_association_ids() from public, anon;
grant execute on function public.current_vendor_bill_association_ids() to authenticated;

drop policy if exists associations_vendor_bill_read on public.associations;
create policy associations_vendor_bill_read on public.associations
  for select to authenticated
  using (
    public.current_vendor_id() is not null
    and id in (select public.current_vendor_bill_association_ids())
  );
