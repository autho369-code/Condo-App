-- 1. Built-in (system) maintenance template groups have portfolio_id NULL, and
--    the only policy (mtg_staff_all) required can_access_portfolio(portfolio_id),
--    so staff saw "Templates (0)" and could not clone them. Let any staff
--    member read system groups (writes stay portfolio-scoped).
drop policy if exists mtg_read_system on public.maintenance_template_groups;
create policy mtg_read_system on public.maintenance_template_groups
  for select to authenticated
  using (portfolio_id is null and (public.is_any_staff() or public.is_platform_operator()));

-- 2. check_insurance_expirations() marks past-due policies 'expired', and the
--    view only returned active/expiring_soon, so expired policies vanished from
--    /insurance (its "Expired" metric could never be non-zero).
create or replace view public.v_upcoming_expirations with (security_invoker = true) as
 SELECT ip.id,
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
    o.full_name AS owner_name,
    o.email AS owner_email,
    a.name AS association_name,
    (ip.expiration_date - CURRENT_DATE) AS days_remaining,
    ip.remind_owner,
    ip.remind_manager,
    ip.reminder_30_sent_at,
    ip.reminder_15_sent_at
   FROM ((public.insurance_policies ip
     JOIN public.owners o ON ((o.id = ip.owner_id)))
     LEFT JOIN public.associations a ON ((a.id = ip.association_id)))
  WHERE ((ip.archived_at IS NULL) AND (ip.status = ANY (ARRAY['active'::text, 'expiring_soon'::text, 'expired'::text])) AND public.can_access_portfolio(o.portfolio_id))
  ORDER BY ip.expiration_date;
