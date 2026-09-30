-- Dues reminders, reworked (AppFolio "Send dues reminders" per homeowner).
-- The old queue_payment_reminders() sent one email per charge (several emails
-- the same morning for one unit), could double-send if the job re-ran, kept
-- sending "PAST DUE" emails to homeowners in collections / foreclosure (the
-- attorney handles those), had no per-homeowner opt-out, and interpolated
-- names into HTML unescaped.
-- Now: one email per homeowner per unit per reminder day, summarising every
-- open charge due that day and the unit's total balance; idempotent; skips
-- opted-out, in-collections and in-foreclosure accounts and owners who prefer
-- postal mail; links to the owner portal payment page.

alter table public.occupancies
  add column if not exists send_dues_reminders boolean not null default true;

create or replace function public.html_escape(p text)
returns text language sql immutable set search_path = pg_catalog as $$
  select replace(replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

create or replace function public.queue_payment_reminders()
returns integer language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  p record;
  r record;
  n_sent integer := 0;
  v_day integer;
  v_portal text;
  v_inserted integer;
begin
  for p in
    select id, company_name, slug, coalesce(default_payment_reminder_days, '{}') as days
      from public.portfolios where suspended_at is null
  loop
    v_portal := case when p.slug ~ '^[a-z0-9][a-z0-9-]{0,62}$'
                     then 'https://' || p.slug || '.portier369.com/portal/pay'
                     else 'https://portier369.com/portal/pay' end;
    foreach v_day in array p.days loop
      for r in
        select occ.id as occupancy_id, occ.allow_online_payments, o.id as owner_id, o.email, o.full_name,
               u.id as unit_id, u.unit_number, a.id as association_id, a.name as association_name,
               sum(cb.balance) as due_amount,
               string_agg(coalesce(nullif(btrim(cb.description), ''), 'Charge') || ' ' || to_char(cb.balance, 'FM$999,999,990.00'), ', ' order by cb.description) as items,
               (select coalesce(sum(b2.balance), 0) from (
                  select c2.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = c2.id), 0) as balance
                    from public.charges c2 where c2.unit_id = u.id) b2 where b2.balance > 0) as unit_balance
          from (select c.id, c.unit_id, c.description, c.due_date,
                       c.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = c.id), 0) as balance
                  from public.charges c
                 where c.due_date = current_date + v_day) cb
          join public.units u on u.id = cb.unit_id
          join public.buildings b on b.id = u.building_id
          join public.associations a on a.id = b.association_id and a.portfolio_id = p.id
          join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.occupancy_type = 'owner'
          join public.owners o on o.id = occ.owner_id
         where cb.balance > 0
           and occ.send_dues_reminders
           and not occ.in_collections and not occ.in_foreclosure
           and o.archived_at is null and o.email is not null and btrim(o.email) <> ''
           and coalesce(o.preferred_comm, 'email') <> 'mail'
         group by occ.id, occ.allow_online_payments, o.id, o.email, o.full_name, u.id, u.unit_number, a.id, a.name
      loop
        insert into public.email_queue (to_email, to_name, subject, body, portfolio_id, association_id,
                                        owner_id, status, idempotency_key)
        values (
          r.email, r.full_name,
          case when v_day > 0 then format('Payment reminder: %s due in %s day%s', to_char(r.due_amount, 'FM$999,999,990.00'), v_day, case when v_day = 1 then '' else 's' end)
               when v_day = 0 then format('Payment due today: %s', to_char(r.due_amount, 'FM$999,999,990.00'))
               else format('Past due: %s was due %s day%s ago', to_char(r.due_amount, 'FM$999,999,990.00'), -v_day, case when v_day = -1 then '' else 's' end) end,
          '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;line-height:1.6;color:#111827">'
            || '<p>Hello ' || public.html_escape(coalesce(nullif(btrim(r.full_name), ''), 'Homeowner')) || ',</p>'
            || '<p>' || case when v_day > 0 then 'This is a friendly reminder that a payment for '
                             when v_day = 0 then 'A payment is due today for '
                             else 'We have not yet received a payment that was due on ' || to_char(current_date + v_day, 'FMMonth FMDD, YYYY') || ' for ' end
            || '<strong>Unit ' || public.html_escape(r.unit_number) || '</strong> at ' || public.html_escape(r.association_name)
            || case when v_day > 0 then ' is due on ' || to_char(current_date + v_day, 'FMMonth FMDD, YYYY') else '' end || '.</p>'
            || '<p>' || public.html_escape(r.items) || '</p>'
            || '<p>Total balance on the account: <strong>' || to_char(r.unit_balance, 'FM$999,999,990.00') || '</strong></p>'
            || case when r.allow_online_payments
                    then '<p><a href="' || v_portal || '" style="display:inline-block;background:#111827;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Pay online</a></p>'
                    else '<p>Please contact the management office to arrange payment.</p>' end
            || '<p style="color:#6b7280;font-size:13px">If you have already paid, thank you — please disregard this message.</p>'
            || '<p style="color:#6b7280;font-size:13px">' || public.html_escape(p.company_name) || '</p></div>',
          p.id, r.association_id, r.owner_id, 'pending',
          'dues-reminder:' || r.occupancy_id || ':' || current_date || ':' || v_day)
        on conflict do nothing;
        get diagnostics v_inserted = row_count;
        n_sent := n_sent + v_inserted;
      end loop;
    end loop;
  end loop;
  return n_sent;
end $$;

create or replace function public.set_occupancy_dues_reminders(p_occupancy_id uuid, p_enabled boolean)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare o record;
begin
  select occ.id, occ.owner_id, occ.unit_id, occ.association_id, occ.send_dues_reminders, a.portfolio_id as pid into o
    from public.occupancies occ join public.associations a on a.id = occ.association_id
   where occ.id = p_occupancy_id for update of occ;
  if not found or not public.is_any_staff() or not public.can_access_association(o.association_id) then
    raise exception 'Ownership record not found' using errcode = 'P0002';
  end if;
  if o.send_dues_reminders is distinct from coalesce(p_enabled, true) then
    update public.occupancies set send_dues_reminders = coalesce(p_enabled, true), updated_at = now() where id = p_occupancy_id;
    insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
    values (o.pid, 'owner', o.owner_id, 'dues_reminders_updated', auth.uid(),
            (select email from auth.users where id = auth.uid()),
            jsonb_build_object('occupancy_id', p_occupancy_id, 'unit_id', o.unit_id,
                               'before', o.send_dues_reminders, 'after', coalesce(p_enabled, true)));
  end if;
end $$;

do $$
begin
  alter function public.queue_payment_reminders() owner to postgres;
  revoke all on function public.queue_payment_reminders() from public, anon, authenticated;
  alter function public.set_occupancy_dues_reminders(uuid, boolean) owner to postgres;
  revoke all on function public.set_occupancy_dues_reminders(uuid, boolean) from public, anon;
  grant execute on function public.set_occupancy_dues_reminders(uuid, boolean) to authenticated, service_role;
end $$;
