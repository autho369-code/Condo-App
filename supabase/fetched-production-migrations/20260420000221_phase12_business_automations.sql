-- =============================================================================
-- Phase 12 — Business automation
--   • Portfolio-level billing policy (late fee, grace, NSF, etc.)
--   • Assessment posting fan-out (charges generated when period → posted)
--   • Daily late-fee poster
--   • Daily payment reminders
--   • Monthly statement generator
--   • Recurring work-order generator
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Portfolio billing policy columns
-- -----------------------------------------------------------------------------
alter table public.portfolios
  add column default_late_fee_amount numeric(10,2) not null default 25.00 check (default_late_fee_amount >= 0),
  add column default_late_fee_grace_days integer not null default 10 check (default_late_fee_grace_days between 0 and 60),
  add column default_nsf_fee_amount numeric(10,2) not null default 35.00 check (default_nsf_fee_amount >= 0),
  add column default_payment_reminder_days integer[] not null default array[14, 7, 1, -7, -30],
  add column statement_generation_day smallint not null default 1 check (statement_generation_day between 1 and 28),
  add column fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12);

comment on column public.portfolios.default_payment_reminder_days is 'Days relative to charge.due_date when reminders fire. Positive = before due; negative = after due.';

-- -----------------------------------------------------------------------------
-- 2. Assessment posting fan-out
--    When assessment_periods.status flips to 'posted', create charges for
--    every active unit in the association using ownership_pct × base_amount.
-- -----------------------------------------------------------------------------
create or replace function public.post_assessment_charges()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  charge_gl_id uuid;
  unit_row record;
  n_charges integer := 0;
begin
  if new.status <> 'posted' or (old.status = 'posted') then
    return new;
  end if;

  -- Look up a sensible GL account for HOA assessments (4xxx income range)
  select id into charge_gl_id
    from public.gl_accounts
   where association_id = new.association_id
     and account_type = 'income'
     and number between 4000 and 4999
     and active
   order by number
   limit 1;

  -- Fan out charges for every active unit
  for unit_row in
    select u.id as unit_id, u.ownership_pct,
           round(((coalesce(u.ownership_pct, 0) / 100.0) * new.base_amount)::numeric, 2) as amount
      from public.units u
      join public.buildings b on b.id = u.building_id
     where b.association_id = new.association_id
       and u.archived_at is null
  loop
    if unit_row.amount > 0 then
      insert into public.charges (
        unit_id, assessment_period_id, charge_type, description,
        amount, due_date, gl_account_id, created_by
      ) values (
        unit_row.unit_id, new.id, 'assessment',
        new.name,
        unit_row.amount,
        coalesce(new.period_start, current_date),
        charge_gl_id,
        new.created_by
      )
      on conflict do nothing;
      n_charges := n_charges + 1;
    end if;
  end loop;

  -- Log to activity
  insert into public.activity (action, details)
  values ('assessment_posted',
          format('Posted %s charges for assessment "%s" (period %s)',
                 n_charges, new.name, new.id));

  return new;
end;
$$;

drop trigger if exists trg_post_assessment_charges on public.assessment_periods;
create trigger trg_post_assessment_charges
  after update of status on public.assessment_periods
  for each row execute function public.post_assessment_charges();

-- -----------------------------------------------------------------------------
-- 3. Late fee poster (daily)
-- -----------------------------------------------------------------------------
create or replace function public.apply_late_fees()
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  portfolio_row record;
  charge_row record;
  n_fees integer := 0;
  late_fee_gl_id uuid;
begin
  for portfolio_row in
    select p.id as portfolio_id,
           p.default_late_fee_amount as fee_amount,
           p.default_late_fee_grace_days as grace_days
      from public.portfolios p
     where p.suspended_at is null
       and p.default_late_fee_amount > 0
  loop
    for charge_row in
      select c.id, c.unit_id, c.assessment_period_id, c.due_date,
             (c.amount - coalesce((select sum(amount) from public.payments
                                     where charge_id = c.id), 0)) as balance_due,
             b.association_id
        from public.charges c
        join public.units u on u.id = c.unit_id
        join public.buildings b on b.id = u.building_id
        join public.associations a on a.id = b.association_id
       where a.portfolio_id = portfolio_row.portfolio_id
         and c.charge_type = 'assessment'
         and c.due_date < (current_date - make_interval(days => portfolio_row.grace_days))
         -- don't stack late fees: skip if we already posted one for this charge
         and not exists (
           select 1 from public.charges lf
           where lf.assessment_period_id = c.assessment_period_id
             and lf.unit_id = c.unit_id
             and lf.charge_type = 'late_fee'
             and lf.description = 'Late fee: ' || c.id::text
         )
    loop
      if charge_row.balance_due > 0 then
        select id into late_fee_gl_id
          from public.gl_accounts
         where association_id = charge_row.association_id
           and number between 4000 and 4999
           and lower(name) like '%late%'
           and active
         limit 1;

        insert into public.charges (
          unit_id, charge_type, description, amount, due_date, gl_account_id
        ) values (
          charge_row.unit_id, 'late_fee',
          'Late fee: ' || charge_row.id::text,
          portfolio_row.fee_amount,
          current_date + 15,
          late_fee_gl_id
        );
        n_fees := n_fees + 1;
      end if;
    end loop;
  end loop;

  return n_fees;
end;
$$;

select cron.schedule(
  'apply-late-fees-daily',
  '15 3 * * *',
  $$ select public.apply_late_fees(); $$
);

-- -----------------------------------------------------------------------------
-- 4. Payment reminder emails (daily)
-- -----------------------------------------------------------------------------
create or replace function public.queue_payment_reminders()
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  portfolio_row record;
  reminder_row record;
  n_sent integer := 0;
  days_offset integer;
  reminder_day integer;
begin
  for portfolio_row in
    select id, company_name, default_payment_reminder_days
      from public.portfolios
     where suspended_at is null
  loop
    foreach reminder_day in array portfolio_row.default_payment_reminder_days
    loop
      days_offset := reminder_day;  -- positive = before due, negative = after due

      for reminder_row in
        select distinct o.email, o.full_name, c.description, c.amount, c.due_date,
               u.unit_number, a.name as association_name, a.id as association_id,
               (c.amount - coalesce((select sum(amount) from public.payments
                                      where charge_id = c.id), 0)) as balance_due
          from public.charges c
          join public.units u on u.id = c.unit_id
          join public.buildings b on b.id = u.building_id
          join public.associations a on a.id = b.association_id
          left join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current'
          join public.owners o on o.id = occ.owner_id
         where a.portfolio_id = portfolio_row.id
           and o.preferred_comm = 'email'
           and o.email is not null
           and c.due_date = (current_date + make_interval(days => days_offset))::date
           and (c.amount - coalesce((select sum(amount) from public.payments where charge_id = c.id), 0)) > 0
      loop
        insert into public.email_queue (
          to_email, to_name, subject, body, association_id, status
        ) values (
          reminder_row.email,
          reminder_row.full_name,
          case
            when days_offset > 0 then format('Payment reminder: %s due in %s days',
                                             to_char(reminder_row.amount, 'FM$999,999.00'), days_offset)
            when days_offset = 0 then format('Payment due today: %s',
                                             to_char(reminder_row.amount, 'FM$999,999.00'))
            else format('PAST DUE: Payment was due %s days ago', abs(days_offset))
          end,
          format(
            '<p>Hello %s,</p><p>This is a reminder that a %s payment for Unit %s at %s is %s on %s.</p>' ||
            '<p>Outstanding balance: <strong>%s</strong></p>' ||
            '<p>Please log in to the homeowner portal to make a payment.</p>',
            coalesce(reminder_row.full_name, 'Homeowner'),
            to_char(reminder_row.amount, 'FM$999,999.00'),
            reminder_row.unit_number,
            reminder_row.association_name,
            case when days_offset >= 0 then 'due' else 'PAST DUE (was due' end,
            to_char(reminder_row.due_date, 'FMMonth DD, YYYY') ||
              case when days_offset < 0 then ')' else '' end,
            to_char(reminder_row.balance_due, 'FM$999,999.00')
          ),
          reminder_row.association_id,
          'pending'
        );
        n_sent := n_sent + 1;
      end loop;
    end loop;
  end loop;
  return n_sent;
end;
$$;

select cron.schedule(
  'queue-payment-reminders-daily',
  '0 13 * * *',  -- 9 AM ET
  $$ select public.queue_payment_reminders(); $$
);

-- -----------------------------------------------------------------------------
-- 5. Monthly statement generator (1st of month)
-- -----------------------------------------------------------------------------
create or replace function public.generate_monthly_statements(
  p_year integer default extract(year from (now() - interval '1 month'))::integer,
  p_month integer default extract(month from (now() - interval '1 month'))::integer
)
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  n_statements integer := 0;
  row record;
  period_start date;
  period_end date;
begin
  period_start := make_date(p_year, p_month, 1);
  period_end := (period_start + interval '1 month')::date;

  for row in
    select u.id as unit_id, b.association_id, occ.owner_id,
           -- opening balance: charges - payments before period_start
           coalesce((select sum(amount) from public.charges
                     where unit_id = u.id and due_date < period_start), 0)
           -
           coalesce((select sum(amount) from public.payments
                     where unit_id = u.id and payment_date < period_start), 0)
             as opening_balance,
           coalesce((select sum(amount) from public.charges
                     where unit_id = u.id and due_date >= period_start and due_date < period_end), 0)
             as total_charges,
           coalesce((select sum(amount) from public.payments
                     where unit_id = u.id and payment_date >= period_start and payment_date < period_end), 0)
             as total_payments
      from public.units u
      join public.buildings b on b.id = u.building_id
      join public.occupancies occ on occ.unit_id = u.id and occ.status = 'current' and occ.is_primary
     where u.archived_at is null
  loop
    insert into public.statements (
      owner_id, unit_id, association_id, period_month, period_year,
      opening_balance, total_charges, total_payments, closing_balance
    ) values (
      row.owner_id, row.unit_id, row.association_id, p_month, p_year,
      row.opening_balance, row.total_charges, row.total_payments,
      row.opening_balance + row.total_charges - row.total_payments
    )
    on conflict do nothing;

    if found then n_statements := n_statements + 1; end if;
  end loop;

  return n_statements;
end;
$$;

-- Run on the 2nd of every month at 02:00 UTC, for the previous month
select cron.schedule(
  'generate-monthly-statements',
  '0 2 2 * *',
  $$ select public.generate_monthly_statements(); $$
);

-- -----------------------------------------------------------------------------
-- 6. Recurring work order generator (daily)
-- -----------------------------------------------------------------------------
create or replace function public.generate_recurring_work_orders()
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  row record;
  new_sr_id uuid;
  next_due date;
  n_generated integer := 0;
begin
  for row in
    select *
      from public.recurring_work_orders
     where auto_generate
       and archived_at is null
       and next_due_date <= current_date
       and (end_date is null or next_due_date <= end_date)
  loop
    -- Create parent service_request
    insert into public.service_requests (
      portfolio_id, association_id, unit_id,
      description, priority, source, created_by
    ) values (
      row.portfolio_id, row.association_id, row.unit_id,
      row.description || E'\n(auto-generated from recurring work order)',
      coalesce(row.priority::text, 'normal')::public.service_request_priority,
      'recurring', row.created_by
    ) returning id into new_sr_id;

    -- Create the work order
    insert into public.work_orders (
      service_request_id, portfolio_id, unit_id, association_id,
      title, description, category, priority, vendor_id,
      trade, created_by
    ) values (
      new_sr_id, row.portfolio_id, row.unit_id, row.association_id,
      row.title, row.description, row.category, row.priority, row.vendor_id,
      row.trade, row.created_by
    );

    -- Advance next_due_date based on frequency + interval_count
    next_due := case row.frequency
      when 'daily'     then row.next_due_date + (row.interval_count || ' days')::interval
      when 'weekly'    then row.next_due_date + (row.interval_count || ' weeks')::interval
      when 'monthly'   then row.next_due_date + (row.interval_count || ' months')::interval
      when 'quarterly' then row.next_due_date + (row.interval_count * 3 || ' months')::interval
      when 'annually'  then row.next_due_date + (row.interval_count || ' years')::interval
    end::date;

    update public.recurring_work_orders
       set next_due_date = next_due,
           last_generated_at = now(),
           updated_at = now()
     where id = row.id;

    n_generated := n_generated + 1;
  end loop;

  return n_generated;
end;
$$;

select cron.schedule(
  'generate-recurring-work-orders',
  '30 2 * * *',
  $$ select public.generate_recurring_work_orders(); $$
);

-- -----------------------------------------------------------------------------
-- 7. Overdue-bills alert (daily, dispatches webhook)
-- -----------------------------------------------------------------------------
create or replace function public.alert_overdue_bills()
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  row record;
  n integer := 0;
begin
  for row in
    select pb.id, pb.portfolio_id, pb.vendor_id, v.name as vendor_name,
           pb.amount, pb.due_date, pb.bill_number
      from public.payable_bills pb
      join public.vendors v on v.id = pb.vendor_id
     where pb.archived_at is null
       and pb.status in ('approved','pending_approval')
       and pb.due_date < current_date
       and pb.paid_at is null
  loop
    perform public.dispatch_webhook(
      row.portfolio_id,
      'bill.created'::public.webhook_event,
      jsonb_build_object(
        'bill_id', row.id, 'vendor_id', row.vendor_id, 'vendor_name', row.vendor_name,
        'amount', row.amount, 'due_date', row.due_date, 'days_overdue',
        (current_date - row.due_date)
      )
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

comment on function public.alert_overdue_bills() is 'Daily: dispatches bill.created webhooks for overdue bills so external systems can follow up.';

-- -----------------------------------------------------------------------------
-- 8. Dispatch webhook on key business events (charge, payment, work order)
-- -----------------------------------------------------------------------------
create or replace function public.dispatch_charge_webhook()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  pid uuid;
begin
  select a.portfolio_id into pid
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = new.unit_id;

  if pid is not null then
    perform public.dispatch_webhook(pid, 'charge.created'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dispatch_charge_created on public.charges;
create trigger trg_dispatch_charge_created
  after insert on public.charges
  for each row execute function public.dispatch_charge_webhook();

create or replace function public.dispatch_payment_webhook()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  pid uuid;
begin
  select a.portfolio_id into pid
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = new.unit_id;

  if pid is not null then
    perform public.dispatch_webhook(pid, 'payment.received'::public.webhook_event, to_jsonb(new));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dispatch_payment_received on public.payments;
create trigger trg_dispatch_payment_received
  after insert on public.payments
  for each row execute function public.dispatch_payment_webhook();

create or replace function public.dispatch_wo_status_webhook()
returns trigger
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  pid uuid;
begin
  if new.status is distinct from old.status then
    select a.portfolio_id into pid
      from public.associations a
     where a.id = new.association_id;

    if pid is not null then
      perform public.dispatch_webhook(
        pid,
        case when new.status in ('completed','done') then 'work_order.completed'
             else 'work_order.status_changed' end::public.webhook_event,
        jsonb_build_object(
          'work_order_id', new.id,
          'old_status', old.status,
          'new_status', new.status,
          'title', new.title,
          'priority', new.priority,
          'vendor_id', new.vendor_id,
          'unit_id', new.unit_id,
          'association_id', new.association_id
        )
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_dispatch_wo_status on public.work_orders;
create trigger trg_dispatch_wo_status
  after update of status on public.work_orders
  for each row execute function public.dispatch_wo_status_webhook();
;
