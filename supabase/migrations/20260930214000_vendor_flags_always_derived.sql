-- Review fix 3 for #81: has_taxpayer_id / has_bank_account were only
-- recomputed when a legacy tax/bank column changed, so any caller allowed to
-- update vendors could PATCH the flags alone and fake "TIN / bank on file".
-- Every top-level vendors update now re-derives both flags from
-- vendor_financial_details. (Flag writes from the private table's own sync
-- trigger run nested and are already correct.) New vendors can't be inserted
-- with the flags pre-set either.

create or replace function public.vendors_move_financials_to_private()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  f jsonb := '{}'::jsonb;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  if tg_op = 'INSERT' and tg_when = 'BEFORE' then
    -- New vendors start with no flags; the AFTER INSERT pass sets them from
    -- whatever tax/bank values were supplied.
    new.has_taxpayer_id := false;
    new.has_bank_account := false;
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
    -- Flags are always derived from the private row (never trusted from the
    -- caller), and set here because the private table's flag trigger can't
    -- update the row this BEFORE trigger is already modifying.
    new.has_taxpayer_id := coalesce((select nullif(btrim(d.taxpayer_id), '') is not null
                                       from public.vendor_financial_details d where d.vendor_id = new.id), false);
    new.has_bank_account := coalesce((select nullif(btrim(d.bank_routing_number), '') is not null
                                             and nullif(btrim(d.bank_account_number), '') is not null
                                        from public.vendor_financial_details d where d.vendor_id = new.id), false);
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

drop trigger if exists trg_vendors_002_move_financials_insert on public.vendors;
create trigger trg_vendors_002_move_financials_insert before insert on public.vendors
  for each row execute function public.vendors_move_financials_to_private();

-- Re-derive every vendor's flags once, in case any were set by hand.
update public.vendors v
   set has_taxpayer_id = coalesce((select nullif(btrim(d.taxpayer_id), '') is not null from public.vendor_financial_details d where d.vendor_id = v.id), false),
       has_bank_account = coalesce((select nullif(btrim(d.bank_routing_number), '') is not null and nullif(btrim(d.bank_account_number), '') is not null
                                      from public.vendor_financial_details d where d.vendor_id = v.id), false);
