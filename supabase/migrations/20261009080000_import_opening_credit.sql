-- Open-balance import: a credit (prepayment) on a unit in the previous
-- system's open-balance file used to be listed and skipped (charges cannot be
-- negative). It is now posted as a homeowner credit, the mirror of an
-- imported charge: Dr the income account a charge of the same category posts
-- to / Cr Accounts Receivable. The unit's balance goes negative by the credit
-- (the app's prepayment model: v_unapplied_credits, the Owner Prepaid report,
-- auto-apply to the next charge). The credit is recorded in imported_balances
-- as a negative amount, so a re-import skips it and the Import Variances
-- report ties out. Additive: one new function.

create or replace function public.import_opening_credit(
  p_unit_id uuid, p_charge_category_id uuid, p_amount numeric, p_description text, p_as_of date)
returns uuid
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_assoc uuid;
  v_pid uuid;
  v_cat public.charge_categories;
  v_probe public.charges;
  v_income uuid;
  v_payment uuid;
begin
  select b.association_id, a.portfolio_id into v_assoc, v_pid
    from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
   where u.id = p_unit_id;
  if v_pid is null then raise exception 'Unit not found' using errcode = 'P0002'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a credit amount greater than zero' using errcode = '22023';
  end if;

  -- The category must be this company's (and this association's or company-wide).
  select * into v_cat from public.charge_categories cc
   where cc.id = p_charge_category_id
     and cc.portfolio_id = v_pid
     and (cc.association_id is null or cc.association_id = v_assoc);
  if not found then raise exception 'Charge category not found' using errcode = 'P0002'; end if;

  -- The income account a charge of this category on this unit posts to.
  v_probe.unit_id := p_unit_id;
  v_probe.charge_category_id := v_cat.id;
  v_probe.charge_type := v_cat.charge_type;
  v_probe.gl_account_id := v_cat.gl_account_id;
  v_income := (public.charge_gl_accounts(v_probe)).income;
  if v_income is null then
    raise exception 'No income account is set up for this company, so the credit cannot be posted' using errcode = '22023';
  end if;

  -- Checks finance access to the unit's association, posts Dr income / Cr A/R
  -- (trg_post_payment_to_gl) and writes the audit log.
  v_payment := public.post_homeowner_credit(p_unit_id, p_amount, p_as_of, v_income, p_description, null);

  insert into public.imported_balances (portfolio_id, association_id, unit_id, as_of_date, imported_balance, memo, charge_id, created_by)
  values (v_pid, v_assoc, p_unit_id, p_as_of, -round(p_amount, 2), p_description, null, auth.uid());
  return v_payment;
end
$function$;

alter function public.import_opening_credit(uuid, uuid, numeric, text, date) owner to postgres;
revoke all on function public.import_opening_credit(uuid, uuid, numeric, text, date) from public, anon;
grant execute on function public.import_opening_credit(uuid, uuid, numeric, text, date) to authenticated, service_role;
