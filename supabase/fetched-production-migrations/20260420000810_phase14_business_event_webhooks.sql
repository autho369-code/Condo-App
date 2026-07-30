-- =============================================================================
-- Phase 14 — Wire all remaining business events to the webhook dispatcher
-- =============================================================================

-- payable_bills: created, approved, paid, voided
create or replace function public.dispatch_bill_webhook()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'INSERT' then
    perform public.dispatch_webhook(new.portfolio_id, 'bill.created'::public.webhook_event, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    if new.status = 'approved' and old.status <> 'approved' then
      perform public.dispatch_webhook(new.portfolio_id, 'bill.approved'::public.webhook_event, to_jsonb(new));
    elsif new.status = 'paid' and old.status <> 'paid' then
      perform public.dispatch_webhook(new.portfolio_id, 'bill.paid'::public.webhook_event, to_jsonb(new));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dispatch_bill on public.payable_bills;
create trigger trg_dispatch_bill
  after insert or update on public.payable_bills
  for each row execute function public.dispatch_bill_webhook();

-- charges: void
create or replace function public.dispatch_charge_status_webhook()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare pid uuid;
begin
  -- resolve portfolio
  select a.portfolio_id into pid
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = new.unit_id;

  if pid is null then return new; end if;

  -- If amount was zeroed out or charge "voided" via update, fire charge.voided
  if tg_op = 'UPDATE' and new.amount is distinct from old.amount and coalesce(new.amount, 0) = 0 then
    perform public.dispatch_webhook(pid, 'charge.voided'::public.webhook_event, to_jsonb(new));
  elsif tg_op = 'UPDATE' and (new.description is distinct from old.description or new.amount is distinct from old.amount or new.due_date is distinct from old.due_date) then
    perform public.dispatch_webhook(pid, 'charge.updated'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dispatch_charge_update on public.charges;
create trigger trg_dispatch_charge_update
  after update on public.charges
  for each row execute function public.dispatch_charge_status_webhook();

-- payments: failed / refunded (inferred from payment_intents)
create or replace function public.dispatch_payment_intent_webhook()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare pid uuid;
begin
  select a.portfolio_id into pid
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = new.unit_id;
  if pid is null then return new; end if;

  if new.status is distinct from old.status then
    if new.status = 'failed' then
      perform public.dispatch_webhook(pid, 'payment.failed'::public.webhook_event, to_jsonb(new));
    elsif new.status = 'refunded' then
      perform public.dispatch_webhook(pid, 'payment.refunded'::public.webhook_event, to_jsonb(new));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dispatch_payment_intent on public.payment_intents;
create trigger trg_dispatch_payment_intent
  after update of status on public.payment_intents
  for each row execute function public.dispatch_payment_intent_webhook();

-- service_requests: created, resolved
create or replace function public.dispatch_sr_webhook()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'INSERT' then
    perform public.dispatch_webhook(new.portfolio_id, 'service_request.created'::public.webhook_event, to_jsonb(new));
  elsif tg_op = 'UPDATE' and new.status = 'completed' and old.status <> 'completed' then
    perform public.dispatch_webhook(new.portfolio_id, 'service_request.resolved'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dispatch_sr on public.service_requests;
create trigger trg_dispatch_sr
  after insert or update on public.service_requests
  for each row execute function public.dispatch_sr_webhook();

-- work_orders: created
create or replace function public.dispatch_wo_created_webhook()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare pid uuid;
begin
  select portfolio_id into pid from public.associations where id = new.association_id;
  if pid is not null then
    perform public.dispatch_webhook(pid, 'work_order.created'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dispatch_wo_created on public.work_orders;
create trigger trg_dispatch_wo_created
  after insert on public.work_orders
  for each row execute function public.dispatch_wo_created_webhook();

-- violations: created, resolved
create or replace function public.dispatch_violation_webhook()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare pid uuid;
begin
  select portfolio_id into pid from public.associations where id = new.association_id;
  if pid is null then return new; end if;

  if tg_op = 'INSERT' then
    perform public.dispatch_webhook(pid, 'violation.created'::public.webhook_event, to_jsonb(new));
  elsif tg_op = 'UPDATE' and new.status in ('cured','closed') and old.status not in ('cured','closed') then
    perform public.dispatch_webhook(pid, 'violation.resolved'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dispatch_violation on public.violations;
create trigger trg_dispatch_violation
  after insert or update on public.violations
  for each row execute function public.dispatch_violation_webhook();

-- notices: sent
create or replace function public.dispatch_notice_webhook()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare pid uuid;
begin
  if tg_op = 'UPDATE' and new.status = 'sent' and old.status <> 'sent' then
    select portfolio_id into pid from public.associations where id = new.association_id;
    if pid is not null then
      perform public.dispatch_webhook(pid, 'notice.sent'::public.webhook_event, to_jsonb(new));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dispatch_notice on public.notices;
create trigger trg_dispatch_notice
  after update of status on public.notices
  for each row execute function public.dispatch_notice_webhook();

-- statements: generated
create or replace function public.dispatch_statement_webhook()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare pid uuid;
begin
  select portfolio_id into pid from public.associations where id = new.association_id;
  if pid is not null then
    perform public.dispatch_webhook(pid, 'statement.generated'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dispatch_statement on public.statements;
create trigger trg_dispatch_statement
  after insert on public.statements
  for each row execute function public.dispatch_statement_webhook();

-- owners: created, updated
create or replace function public.dispatch_owner_webhook()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.portfolio_id is null then return new; end if;

  if tg_op = 'INSERT' then
    perform public.dispatch_webhook(new.portfolio_id, 'owner.created'::public.webhook_event, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    if new.email is distinct from old.email
       or new.full_name is distinct from old.full_name
       or new.phone is distinct from old.phone then
      perform public.dispatch_webhook(new.portfolio_id, 'owner.updated'::public.webhook_event, to_jsonb(new));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dispatch_owner on public.owners;
create trigger trg_dispatch_owner
  after insert or update on public.owners
  for each row execute function public.dispatch_owner_webhook();

-- inspections: completed
create or replace function public.dispatch_inspection_webhook()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'UPDATE' and new.status = 'completed' and old.status <> 'completed' then
    perform public.dispatch_webhook(new.portfolio_id, 'inspection.completed'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;
drop trigger if exists trg_dispatch_inspection on public.inspections;
create trigger trg_dispatch_inspection
  after update of status on public.inspections
  for each row execute function public.dispatch_inspection_webhook();
;
