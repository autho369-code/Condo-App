-- Separate migration so the new 'nsf_fee' enum value is committed before it's referenced.
create or replace function public.post_nsf_fee(p_payment_id uuid, p_reason text default 'NSF - returned payment')
returns uuid
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  payment_row public.payments;
  v_association_id uuid;
  v_portfolio_id uuid;
  fee_amount numeric(10,2);
  new_charge_id uuid;
begin
  select * into payment_row from public.payments where id = p_payment_id;
  if not found then raise exception 'payment not found'; end if;

  select a.id, a.portfolio_id into v_association_id, v_portfolio_id
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = payment_row.unit_id;

  select coalesce(a.nsf_fee_amount_override, p.default_nsf_fee_amount) into fee_amount
    from public.associations a
    join public.portfolios p on p.id = a.portfolio_id
   where a.id = v_association_id;

  insert into public.charges (
    unit_id, charge_type, description, amount, due_date
  ) values (
    payment_row.unit_id, 'nsf_fee', p_reason, fee_amount, current_date + 15
  ) returning id into new_charge_id;

  update public.occupancies
     set nsf_count = nsf_count + 1, updated_at = now()
   where unit_id = payment_row.unit_id and status = 'current';

  return new_charge_id;
end;
$$;

grant execute on function public.post_nsf_fee(uuid, text) to authenticated;
;
