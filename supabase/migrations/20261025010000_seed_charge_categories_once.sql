-- Standard charge categories are added once per company (2026-10-25).
--
-- seed_standard_charge_categories ended in `on conflict do nothing`, but the
-- only unique index, uq_charge_categories_code (portfolio_id, association_id,
-- lower(code)), never conflicts for company-wide categories: their
-- association_id is null and nulls are distinct. A second call added a second
-- full set (found by the browser tests, e2e/). The new-company trigger
-- (trg_seed_standard_charge_categories) inserts the same set on a brand-new
-- company, so it can't collide; nothing in the app calls the function again,
-- and production has no duplicates (checked 2026-10-25). Now each standard row
-- is added only when the company has no company-wide category with that code.
--
-- Also: the function was executable by anyone (PUBLIC, anon) and checked
-- permission only inside. It needs a signed-in company admin, so execute goes
-- to authenticated and service_role only.
--
-- Body is the live definition (pg_get_functiondef, 2026-10-25) with only the
-- insert changed.

create or replace function public.seed_standard_charge_categories(p_portfolio_id uuid)
 returns integer
 language plpgsql
 set search_path to 'pg_catalog', 'public'
as $function$
declare n integer := 0;
begin
  if not public.can_admin_portfolio(p_portfolio_id) then
    raise exception 'permission denied';
  end if;
  insert into public.charge_categories (
    portfolio_id, name, code, description, default_amount, default_frequency,
    charge_type, is_income, is_assessment, is_fee, is_system, applies_by_default, sort_order
  )
  select p_portfolio_id, v.name, v.code, v.description, 0, v.default_frequency::public.recurring_frequency,
         v.charge_type::public.charge_type, true, v.is_assessment, v.is_fee, true, v.applies_by_default, v.sort_order
    from (values
      ('HOA Dues',           'DUES',      'Regular monthly HOA assessment',      'monthly',  'assessment',         true,  false, true,  10),
      ('Special Assessment', 'SPECIAL',   'One-time or short-term assessment',   'monthly',  'special_assessment', true,  false, false, 20),
      ('Parking Fee',        'PARKING',   'Monthly parking space rental',        'monthly',  'amenity_fee',        false, true,  false, 30),
      ('Storage Fee',        'STORAGE',   'Monthly storage locker rental',       'monthly',  'amenity_fee',        false, true,  false, 35),
      ('Cable TV',           'CABLE',     'Bulk cable service passed through',   'monthly',  'amenity_fee',        false, true,  false, 40),
      ('Internet',           'INTERNET',  'Bulk internet service passed through','monthly',  'amenity_fee',        false, true,  false, 45),
      ('Pool Key Fee',       'POOLKEY',   'Pool key / fob issuance',             'annually', 'amenity_fee',        false, true,  false, 50),
      ('Move-In Fee',        'MOVEIN',    'One-time move-in charge',             'annually', 'move_fee',           false, true,  false, 55),
      ('Move-Out Fee',       'MOVEOUT',   'One-time move-out charge',            'annually', 'move_fee',           false, true,  false, 60),
      ('Late Fee',           'LATEFEE',   'Auto-posted late payment fee',        'monthly',  'late_fee',           false, true,  false, 70),
      ('NSF Fee',            'NSFFEE',    'Returned payment fee',                'monthly',  'nsf_fee',            false, true,  false, 75),
      ('Violation Fine',     'VIOLATION', 'HOA rules violation fine',            'monthly',  'fine',               false, true,  false, 80),
      ('Other',              'OTHER',     'Custom / miscellaneous charge',       'monthly',  'other',              false, false, false, 100)
    ) as v(name, code, description, default_frequency, charge_type, is_assessment, is_fee, applies_by_default, sort_order)
   where not exists (
     select 1 from public.charge_categories c
      where c.portfolio_id = p_portfolio_id
        and c.association_id is null
        and lower(c.code) = lower(v.code));
  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function public.seed_standard_charge_categories(uuid) from public, anon;
grant execute on function public.seed_standard_charge_categories(uuid) to authenticated, service_role;
