-- apply_late_fees: switch balance computation from payments.charge_id → payment_applications
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
     where p.suspended_at is null and p.default_late_fee_amount > 0
  loop
    for charge_row in
      select c.id, c.unit_id, c.assessment_period_id, c.due_date,
             (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as balance_due,
             b.association_id
        from public.charges c
        join public.units u on u.id = c.unit_id
        join public.buildings b on b.id = u.building_id
        join public.associations a on a.id = b.association_id
       where a.portfolio_id = portfolio_row.portfolio_id
         and c.charge_type = 'assessment'
         and c.due_date < (current_date - make_interval(days => portfolio_row.grace_days))
         and not exists (
           select 1 from public.charges lf
           where lf.unit_id = c.unit_id
             and lf.charge_type = 'late_fee'
             and lf.description = 'Late fee: ' || c.id::text
         )
    loop
      if charge_row.balance_due > 0 then
        select id into late_fee_gl_id
          from public.gl_accounts
         where portfolio_id = portfolio_row.portfolio_id
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

-- queue_payment_reminders: same fix
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
      from public.portfolios where suspended_at is null
  loop
    foreach reminder_day in array portfolio_row.default_payment_reminder_days loop
      days_offset := reminder_day;
      for reminder_row in
        select distinct o.email, o.full_name, c.description, c.amount, c.due_date,
               u.unit_number, a.name as association_name, a.id as association_id,
               (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) as balance_due
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
           and (c.amount - coalesce((select sum(amount_applied) from public.payment_applications where charge_id = c.id), 0)) > 0
      loop
        insert into public.email_queue (
          to_email, to_name, subject, body, association_id, status
        ) values (
          reminder_row.email, reminder_row.full_name,
          case
            when days_offset > 0 then format('Payment reminder: %s due in %s days', to_char(reminder_row.amount, 'FM$999,999.00'), days_offset)
            when days_offset = 0 then format('Payment due today: %s',               to_char(reminder_row.amount, 'FM$999,999.00'))
            else                      format('PAST DUE: Payment was due %s days ago', abs(days_offset))
          end,
          format(
            '<p>Hello %s,</p><p>This is a reminder that a %s payment for Unit %s at %s is %s on %s.</p><p>Outstanding balance: <strong>%s</strong></p><p>Please log in to the homeowner portal to make a payment.</p>',
            coalesce(reminder_row.full_name, 'Homeowner'),
            to_char(reminder_row.amount, 'FM$999,999.00'),
            reminder_row.unit_number,
            reminder_row.association_name,
            case when days_offset >= 0 then 'due' else 'PAST DUE (was due' end,
            to_char(reminder_row.due_date, 'FMMonth DD, YYYY') || case when days_offset < 0 then ')' else '' end,
            to_char(reminder_row.balance_due, 'FM$999,999.00')
          ),
          reminder_row.association_id, 'pending'
        );
        n_sent := n_sent + 1;
      end loop;
    end loop;
  end loop;
  return n_sent;
end;
$$;;
