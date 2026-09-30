-- Homeowner collection status (AppFolio "Homeowner status" block):
-- in foreclosure / in collections / certified funds only / allow online payments /
-- require online payments in full, plus a delinquency-notes thread.
-- The flags are enforced, not decorative:
--   * certified_funds_only  -> office receipts by check/cash/other are rejected (trigger)
--   * allow_online_payments -> portal checkout and autopay refuse (app code)
--   * require_full_online_payment -> portal checkout must cover the full balance (app code)

alter table public.occupancies
  add column if not exists in_foreclosure boolean not null default false,
  add column if not exists in_collections boolean not null default false,
  add column if not exists certified_funds_only boolean not null default false,
  add column if not exists allow_online_payments boolean not null default true,
  add column if not exists require_full_online_payment boolean not null default false;

create table if not exists public.occupancy_delinquency_notes (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  occupancy_id uuid not null references public.occupancies(id) on delete cascade,
  note text not null check (length(btrim(note)) between 1 and 4000),
  created_by uuid,
  created_by_email text,
  created_at timestamptz not null default now()
);
create index if not exists occupancy_delinquency_notes_occ_idx
  on public.occupancy_delinquency_notes (occupancy_id, created_at desc);
alter table public.occupancy_delinquency_notes enable row level security;
drop policy if exists occupancy_delinquency_notes_staff_read on public.occupancy_delinquency_notes;
create policy occupancy_delinquency_notes_staff_read on public.occupancy_delinquency_notes
  for select to authenticated
  using (public.is_any_staff() and public.can_access_portfolio(portfolio_id));
revoke insert, update, delete on public.occupancy_delinquency_notes from authenticated, anon;
grant select on public.occupancy_delinquency_notes to authenticated;

create or replace function public.set_occupancy_collection_status(
  p_occupancy_id uuid, p_in_foreclosure boolean, p_in_collections boolean,
  p_certified_funds_only boolean, p_allow_online_payments boolean, p_require_full_online_payment boolean)
returns void
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare o record;
begin
  select occ.*, a.portfolio_id as pid into o
    from public.occupancies occ join public.associations a on a.id = occ.association_id
   where occ.id = p_occupancy_id for update of occ;
  if not found or not public.can_manage_finance(o.pid) or not public.can_access_association(o.association_id) then
    raise exception 'Ownership record not found' using errcode = 'P0002';
  end if;
  update public.occupancies set
    in_foreclosure = coalesce(p_in_foreclosure, false),
    in_collections = coalesce(p_in_collections, false) or coalesce(p_in_foreclosure, false),
    certified_funds_only = coalesce(p_certified_funds_only, false),
    allow_online_payments = coalesce(p_allow_online_payments, true),
    require_full_online_payment = coalesce(p_require_full_online_payment, false),
    updated_at = now()
  where id = p_occupancy_id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (o.pid, 'owner', o.owner_id, 'collection_status_updated', auth.uid(),
          (select email from auth.users where id = auth.uid()),
          jsonb_build_object('occupancy_id', p_occupancy_id, 'unit_id', o.unit_id,
            'before', jsonb_build_object('in_foreclosure', o.in_foreclosure, 'in_collections', o.in_collections,
              'certified_funds_only', o.certified_funds_only, 'allow_online_payments', o.allow_online_payments,
              'require_full_online_payment', o.require_full_online_payment),
            'after', jsonb_build_object('in_foreclosure', coalesce(p_in_foreclosure, false),
              'in_collections', coalesce(p_in_collections, false) or coalesce(p_in_foreclosure, false),
              'certified_funds_only', coalesce(p_certified_funds_only, false),
              'allow_online_payments', coalesce(p_allow_online_payments, true),
              'require_full_online_payment', coalesce(p_require_full_online_payment, false))));
end $$;

create or replace function public.add_occupancy_delinquency_note(p_occupancy_id uuid, p_note text)
returns uuid
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare o record; v_id uuid;
begin
  select occ.id, occ.association_id, a.portfolio_id as pid into o
    from public.occupancies occ join public.associations a on a.id = occ.association_id
   where occ.id = p_occupancy_id;
  if not found or not public.is_any_staff() or not public.can_access_portfolio(o.pid)
     or not public.can_access_association(o.association_id) then
    raise exception 'Ownership record not found' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'Write a note first' using errcode = '22023';
  end if;
  insert into public.occupancy_delinquency_notes (portfolio_id, occupancy_id, note, created_by, created_by_email)
  values (o.pid, p_occupancy_id, btrim(p_note), auth.uid(), (select email from auth.users where id = auth.uid()))
  returning id into v_id;
  return v_id;
end $$;

-- Certified funds only: refuse personal-check / cash / "other" receipts for a unit
-- whose current owner is flagged. Stripe (online), ACH, wire, money order and
-- cashier's check receipts, and manual adjustments, are unaffected.
create or replace function public.enforce_certified_funds_only()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.method in ('check', 'cash', 'other') and exists (
    select 1 from public.occupancies o
     where o.unit_id = new.unit_id and o.status = 'current' and o.certified_funds_only
  ) then
    raise exception 'This homeowner is on certified funds only. Record a money order, cashier''s check or wire instead.'
      using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists trg_enforce_certified_funds_only on public.payments;
create trigger trg_enforce_certified_funds_only before insert on public.payments
  for each row execute function public.enforce_certified_funds_only();

do $$
declare f text;
begin
  foreach f in array array[
    'public.set_occupancy_collection_status(uuid, boolean, boolean, boolean, boolean, boolean)',
    'public.add_occupancy_delinquency_note(uuid, text)'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  alter function public.enforce_certified_funds_only() owner to postgres;
  revoke all on function public.enforce_certified_funds_only() from public, anon, authenticated;
end $$;
