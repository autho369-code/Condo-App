-- Insurance expiry reminders (30/15-day emails to owner and manager) +
-- residents may update their own policies (reminder prefs, certificate).
-- Applied to live DB via MCP on 2026-07-14.

alter table public.insurance_policies
  add column if not exists remind_owner boolean not null default true,
  add column if not exists remind_manager boolean not null default true,
  add column if not exists reminder_30_sent_at timestamptz,
  add column if not exists reminder_15_sent_at timestamptz;

drop policy if exists insurance_resident_update on public.insurance_policies;
create policy insurance_resident_update on public.insurance_policies
  for update
  using (is_portal_resident() and owner_id = current_owner_id())
  with check (is_portal_resident() and owner_id = current_owner_id());

-- Status refresh used by the daily reminder cron. (The 20260607 migration
-- defined this but it was missing from the live database.)
create or replace function public.check_insurance_expirations()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.insurance_policies
  set status = 'expiring_soon', updated_at = now()
  where status = 'active'
    and expiration_date <= (current_date + interval '30 days')
    and expiration_date > current_date;

  update public.insurance_policies
  set status = 'expired', updated_at = now()
  where status in ('active', 'expiring_soon')
    and expiration_date < current_date;
end;
$$;

-- Recreate the staff view with the new reminder columns appended.
-- (Live definition comes from scope_definer_views — keeps can_access_portfolio.)
create or replace view public.v_upcoming_expirations as
select ip.id,
    ip.owner_id,
    ip.association_id,
    ip.policy_number,
    ip.insurance_company,
    ip.coverage_amount,
    ip.liability_amount,
    ip.deductible_amount,
    ip.effective_date,
    ip.expiration_date,
    ip.certificate_file_url,
    ip.extracted_fields,
    ip.extraction_status,
    ip.status,
    ip.notes,
    ip.created_at,
    ip.updated_at,
    ip.archived_at,
    o.full_name as owner_name,
    o.email as owner_email,
    a.name as association_name,
    ip.expiration_date - current_date as days_remaining,
    ip.remind_owner,
    ip.remind_manager,
    ip.reminder_30_sent_at,
    ip.reminder_15_sent_at
from insurance_policies ip
join owners o on o.id = ip.owner_id
left join associations a on a.id = ip.association_id
where ip.archived_at is null
  and (ip.status = any (array['active'::text, 'expiring_soon'::text]))
  and can_access_portfolio(o.portfolio_id)
order by ip.expiration_date;
