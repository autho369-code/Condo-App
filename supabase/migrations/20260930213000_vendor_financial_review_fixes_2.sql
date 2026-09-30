-- Second round of #81 review fixes.
-- 1. assemble_vendor_1099_data trusted every caller without a user id. Anonymous
--    Data API requests also have none, so trust is now limited to service jobs:
--    the service_role JWT, or a direct database session (cron / migrations)
--    that is not the PostgREST authenticator. The report wrappers that call it
--    are (re)revoked from client roles as well.
-- 2. Legacy vendors tax/bank columns are emptied: their values already live in
--    vendor_financial_details, and while they stay populated board members,
--    vendors and non-finance staff can read them through the Data API.
--    The transition trigger now MOVES values instead of copying them: a write
--    to a legacy column (by code not yet redeployed) lands in the private table
--    and the legacy column is left empty. Only changed fields are moved, so a
--    form re-submitting other fields never wipes stored numbers.

revoke execute on function public.report_data_vendor_1099(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.report_data_dispatch(uuid, text, jsonb) from public, anon, authenticated;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.assemble_vendor_1099_data(uuid, integer)'::regprocedure);
  if position('(auth.uid() is null or public.can_manage_finance(p_portfolio_id)' in def) = 0 then
    raise exception 'vendor_financial_review_fixes_2: assemble_vendor_1099_data drifted';
  end if;
  def := replace(def, '(auth.uid() is null or public.can_manage_finance(p_portfolio_id)',
    '(auth.role() = ''service_role'' or (auth.uid() is null and session_user <> ''authenticator'')'
    || ' or public.can_manage_finance(p_portfolio_id)');
  execute def;
end $$;

-- Move (not copy) legacy writes into the private table.
create or replace function public.vendors_move_financials_to_private()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  f jsonb := '{}'::jsonb;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.taxpayer_id is distinct from old.taxpayer_id and new.taxpayer_id is not null then f := f || jsonb_build_object('taxpayer_id', new.taxpayer_id); end if;
    if new.tax_account_number is distinct from old.tax_account_number and new.tax_account_number is not null then f := f || jsonb_build_object('tax_account_number', new.tax_account_number); end if;
    if new.bank_routing_number is distinct from old.bank_routing_number and new.bank_routing_number is not null then f := f || jsonb_build_object('bank_routing_number', new.bank_routing_number); end if;
    if new.bank_account_number is distinct from old.bank_account_number and new.bank_account_number is not null then f := f || jsonb_build_object('bank_account_number', new.bank_account_number); end if;
    if f <> '{}'::jsonb then
      insert into public.vendor_financial_details (vendor_id, portfolio_id, taxpayer_id, tax_account_number, bank_routing_number, bank_account_number, updated_by)
      values (new.id, new.portfolio_id, f ->> 'taxpayer_id', f ->> 'tax_account_number', f ->> 'bank_routing_number', f ->> 'bank_account_number', auth.uid())
      on conflict (vendor_id) do update set
        taxpayer_id         = case when f ? 'taxpayer_id' then excluded.taxpayer_id else vendor_financial_details.taxpayer_id end,
        tax_account_number  = case when f ? 'tax_account_number' then excluded.tax_account_number else vendor_financial_details.tax_account_number end,
        bank_routing_number = case when f ? 'bank_routing_number' then excluded.bank_routing_number else vendor_financial_details.bank_routing_number end,
        bank_account_number = case when f ? 'bank_account_number' then excluded.bank_account_number else vendor_financial_details.bank_account_number end,
        updated_at = now(), updated_by = excluded.updated_by;
    end if;
    new.taxpayer_id := null; new.tax_account_number := null;
    new.bank_routing_number := null; new.bank_account_number := null;
    if f <> '{}'::jsonb then
      -- Set the flags here: the private table's flag trigger can't update the
      -- row this BEFORE trigger is already modifying.
      select coalesce(nullif(btrim(d.taxpayer_id), '') is not null, false),
             coalesce(nullif(btrim(d.bank_routing_number), '') is not null and nullif(btrim(d.bank_account_number), '') is not null, false)
        into new.has_taxpayer_id, new.has_bank_account
        from public.vendor_financial_details d where d.vendor_id = new.id;
    end if;
    return new;
  end if;
  -- AFTER INSERT: the vendor row exists now, so the private row can reference it.
  if new.taxpayer_id is not null or new.tax_account_number is not null
     or new.bank_routing_number is not null or new.bank_account_number is not null then
    insert into public.vendor_financial_details (vendor_id, portfolio_id, taxpayer_id, tax_account_number, bank_routing_number, bank_account_number, updated_by)
    values (new.id, new.portfolio_id, new.taxpayer_id, new.tax_account_number, new.bank_routing_number, new.bank_account_number, auth.uid())
    on conflict (vendor_id) do nothing;
    update public.vendors
       set taxpayer_id = null, tax_account_number = null, bank_routing_number = null, bank_account_number = null,
           has_taxpayer_id = nullif(btrim(coalesce(new.taxpayer_id, '')), '') is not null,
           has_bank_account = nullif(btrim(coalesce(new.bank_routing_number, '')), '') is not null
                              and nullif(btrim(coalesce(new.bank_account_number, '')), '') is not null
     where id = new.id;
  end if;
  return null;
end $$;

-- Flag sync from the private table: skip when fired from a vendors trigger
-- (that trigger sets the flags itself; updating vendors here would conflict).
create or replace function public.vendor_financial_details_sync_flags()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v uuid := coalesce(new.vendor_id, old.vendor_id);
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  update public.vendors
     set has_taxpayer_id = coalesce(tg_op <> 'DELETE' and nullif(btrim(new.taxpayer_id), '') is not null, false),
         has_bank_account = coalesce(tg_op <> 'DELETE' and nullif(btrim(new.bank_routing_number), '') is not null
                                     and nullif(btrim(new.bank_account_number), '') is not null, false)
   where id = v;
  return null;
end $$;

drop trigger if exists trg_vendors_copy_financials on public.vendors;
drop function if exists public.vendors_copy_financials_to_private();
drop trigger if exists trg_vendors_002_move_financials on public.vendors;
create trigger trg_vendors_002_move_financials before update on public.vendors
  for each row execute function public.vendors_move_financials_to_private();
drop trigger if exists trg_vendors_move_financials_after_insert on public.vendors;
create trigger trg_vendors_move_financials_after_insert after insert on public.vendors
  for each row execute function public.vendors_move_financials_to_private();

-- Catch anything written since the first backfill, then empty the legacy columns.
insert into public.vendor_financial_details (vendor_id, portfolio_id, taxpayer_id, tax_account_number, bank_routing_number, bank_account_number)
select id, portfolio_id, taxpayer_id, tax_account_number, bank_routing_number, bank_account_number
  from public.vendors
 where portfolio_id is not null
   and (taxpayer_id is not null or tax_account_number is not null or bank_routing_number is not null or bank_account_number is not null)
on conflict (vendor_id) do update set
  taxpayer_id         = coalesce(vendor_financial_details.taxpayer_id, excluded.taxpayer_id),
  tax_account_number  = coalesce(vendor_financial_details.tax_account_number, excluded.tax_account_number),
  bank_routing_number = coalesce(vendor_financial_details.bank_routing_number, excluded.bank_routing_number),
  bank_account_number = coalesce(vendor_financial_details.bank_account_number, excluded.bank_account_number);
-- (the BEFORE UPDATE trigger only moves non-null changes, so clearing is safe)
update public.vendors
   set taxpayer_id = null, tax_account_number = null, bank_routing_number = null, bank_account_number = null
 where taxpayer_id is not null or tax_account_number is not null or bank_routing_number is not null or bank_account_number is not null;
