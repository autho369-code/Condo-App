-- The email sender treats email_queue.body as HTML. The emergency alert wrote
-- plain text (line breaks collapsed) and embedded the resident's description
-- unescaped. Build the same escaped, pre-wrapped body that lib/email/queue.ts
-- textToHtml() produces, and send from the verified default sender.
create or replace function public.service_request_emergency_alert()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_assoc text; v_unit text; v_company text; v_support text; v_text text; v_html text; r record;
begin
  if new.priority <> 'emergency' then return new; end if;
  begin
    select a.name into v_assoc from public.associations a where a.id = new.association_id;
    select u.unit_number into v_unit from public.units u where u.id = new.unit_id;
    select p.company_name, p.support_email into v_company, v_support from public.portfolios p where p.id = new.portfolio_id;
    v_text := 'An emergency service request was just submitted.' || chr(10) || chr(10)
           || 'Request: #' || coalesce(new.number, '—') || chr(10)
           || 'Association: ' || coalesce(v_assoc, '—') || chr(10)
           || 'Unit: ' || coalesce(v_unit, 'common area') || chr(10)
           || 'Permission to enter: ' || case when new.permission_to_enter then 'yes' else 'no' end || chr(10) || chr(10)
           || coalesce(new.description, '') || chr(10) || chr(10)
           || 'Respond within 2 hours. Open the Service Requests queue in Portier369 to dispatch a vendor.';
    v_html := '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;white-space:pre-wrap;line-height:1.6;color:#111827">'
           || replace(replace(replace(v_text, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
           || '</div>';
    for r in
      select distinct lower(btrim(e)) as email from (
        select pr.email as e
          from public.association_managers am join public.profiles pr on pr.id = am.user_id
         where am.association_id = new.association_id and am.ended_at is null and pr.disabled_at is null
        union all
        -- No association-scoped managers: every manager in the company.
        select pr.email
          from public.profiles pr
         where pr.portfolio_id = new.portfolio_id and pr.hoa_role = 'manager' and pr.disabled_at is null
           and not exists (select 1 from public.association_managers am
                            where am.association_id = new.association_id and am.ended_at is null)
        union all select v_support
      ) x where e is not null and btrim(e) like '%@%'
    loop
      insert into public.email_queue (to_email, subject, body, association_id, portfolio_id, from_address, from_name, idempotency_key)
      values (r.email,
              'EMERGENCY service request #' || coalesce(new.number, '') || ' — ' || coalesce(v_assoc, 'association') || coalesce(' unit ' || v_unit, ''),
              v_html, new.association_id, new.portfolio_id, 'hello@portier369.com', coalesce(v_company, 'Portier369'),
              'sr-emergency:' || new.id || ':' || r.email)
      on conflict do nothing;
    end loop;
  exception when others then
    raise warning 'service_request_emergency_alert failed for %: %', new.id, sqlerrm;
  end;
  return new;
end $$;
