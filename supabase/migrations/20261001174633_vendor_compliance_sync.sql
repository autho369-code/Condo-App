-- Vendors save their insurance/license expirations to vendor_compliance, but
-- managers, boards, company admins, alerts and the vendor AI read the
-- vendors.*_expiration columns — so dates a vendor entered never reached
-- management. Copy each vendor_compliance save onto the vendor row (the
-- vendors_self_service_guard trigger lets nested trigger updates through).
create or replace function public.sync_vendor_compliance_to_vendor()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $$
begin
  update public.vendors
     set workers_comp_expiration      = new.workers_comp_expiration,
         general_liability_expiration = new.general_liability_expiration,
         epa_certification_expiration = new.epa_certification_expiration,
         auto_insurance_expiration    = new.auto_insurance_expiration,
         state_license_expiration     = new.state_license_expiration,
         contract_expiration          = new.contract_expiration,
         updated_at = now()
   where id = new.vendor_id;
  return new;
end;
$$;
revoke all on function public.sync_vendor_compliance_to_vendor() from public, anon, authenticated;

drop trigger if exists trg_vendor_compliance_sync on public.vendor_compliance;
create trigger trg_vendor_compliance_sync
  after insert or update on public.vendor_compliance
  for each row execute function public.sync_vendor_compliance_to_vendor();
