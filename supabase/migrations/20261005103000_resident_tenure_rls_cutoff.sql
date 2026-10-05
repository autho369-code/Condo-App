-- Tenure isolation for the owner portal, enforced in RLS.
--
-- When a unit is sold, the buyer becomes a current resident of the same
-- unit_id the seller used. The resident read policies below only checked
-- "unit is one of my current units", so a buyer could read the seller's
-- payments, service requests, work orders (and their messages) and payment
-- plans straight from the API. The portal already hid them in app code
-- (app/portal/_lib/tenure.ts: rows dated on/after the owner's current
-- occupancy move_in_date); this migration mirrors that rule in the database.
--
-- Dates compared (same columns the app's tenure filter uses):
--   payments.payment_date, service_requests.created_at,
--   work_orders.created_at, work_order_messages -> work_orders.created_at,
--   payment_plans.created_at.
-- A null cutoff (no recorded move-in) means no cutoff, as in the app.
-- All existing conditions are kept.

create or replace function public.current_resident_unit_since(p_unit uuid)
returns date
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  -- Several current rows for one unit: the earliest wins, and any row with
  -- no move-in date means no cutoff (matches ownerTenureCutoffs).
  select case when bool_or(o.move_in_date is null) then null else min(o.move_in_date) end
    from public.occupancies o
   where o.owner_id = public.current_owner_id()
     and o.status = 'current'
     and o.unit_id = p_unit;
$function$;

revoke all on function public.current_resident_unit_since(uuid) from public;
revoke all on function public.current_resident_unit_since(uuid) from anon;
grant execute on function public.current_resident_unit_since(uuid) to authenticated;

-- payments: payment_date >= move-in
alter policy payments_resident_read on public.payments
  using (
    is_portal_resident()
    and unit_id in (select current_resident_unit_ids())
    and (
      current_resident_unit_since(unit_id) is null
      or payment_date >= current_resident_unit_since(unit_id)
    )
  );

-- work_orders: created_at (local date) >= move-in
alter policy work_orders_resident_read on public.work_orders
  using (
    is_portal_resident()
    and unit_id in (select current_resident_unit_ids())
    and (
      current_resident_unit_since(unit_id) is null
      or created_at::date >= current_resident_unit_since(unit_id)
    )
  );

-- service_requests: rows naming this owner stay visible; unit rows naming no
-- owner only from move-in on; rows naming another owner are hidden (matches
-- app/portal/service-requests/page.tsx).
alter policy service_requests_resident_read on public.service_requests
  using (
    is_portal_resident()
    and (
      homeowner_id = current_owner_id()
      or (
        unit_id in (select current_resident_unit_ids())
        and (
          owner_id = current_owner_id()
          or (
            homeowner_id is null
            and owner_id is null
            and (
              current_resident_unit_since(unit_id) is null
              or created_at::date >= current_resident_unit_since(unit_id)
            )
          )
        )
      )
    )
  );

-- work_order_messages: parent work order must be inside the tenure
alter policy wo_msg_resident_select on public.work_order_messages
  using (
    exists (
      select 1
        from public.work_orders wo
       where wo.id = work_order_messages.work_order_id
         and wo.unit_id in (select current_resident_unit_ids())
         and (
           current_resident_unit_since(wo.unit_id) is null
           or wo.created_at::date >= current_resident_unit_since(wo.unit_id)
         )
    )
  );

-- payment_plans: a plan naming an owner is visible only to that owner; a
-- plan naming no owner only from move-in on (matches app/portal/ledger).
alter policy payment_plans_owner_read on public.payment_plans
  using (
    unit_id in (select current_resident_unit_ids())
    and (
      owner_id = current_owner_id()
      or (
        owner_id is null
        and (
          current_resident_unit_since(unit_id) is null
          or created_at::date >= current_resident_unit_since(unit_id)
        )
      )
    )
  );
