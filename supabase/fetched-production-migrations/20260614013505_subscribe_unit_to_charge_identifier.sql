create or replace function public.subscribe_unit_to_charge(
  p_unit_id uuid,
  p_charge_category_id uuid,
  p_amount numeric default null::numeric,
  p_frequency recurring_frequency default null::recurring_frequency,
  p_start_date date default current_date,
  p_memo text default null::text,
  p_identifier text default null::text
)
returns unit_recurring_charges
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare cat public.charge_categories; row public.unit_recurring_charges;
begin
  select * into cat from public.charge_categories where id = p_charge_category_id;
  if not found then raise exception 'charge category not found'; end if;
  if not public.can_manage_finance(cat.portfolio_id) then raise exception 'permission denied'; end if;
  insert into public.unit_recurring_charges (
    unit_id, charge_category_id, amount, frequency, start_date, next_post_date, memo, identifier, created_by
  ) values (
    p_unit_id, p_charge_category_id,
    coalesce(p_amount, cat.default_amount),
    coalesce(p_frequency, cat.default_frequency),
    p_start_date, p_start_date, p_memo, p_identifier, auth.uid()
  ) returning * into row;
  return row;
end;
$function$;;
