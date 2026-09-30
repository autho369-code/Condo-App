-- Security: vendor tax IDs (EIN/SSN) and bank routing/account numbers lived on
-- vendors, which board members (vendors_board_read) and every staff member can
-- read in full through the Data API. RLS limits rows, not columns.
-- Phase 1 (this migration): the sensitive values move to
-- vendor_financial_details — readable/writable by finance staff, company
-- admins and operators only, like owner_financial_details — and vendors gains
-- non-sensitive has_taxpayer_id / has_bank_account flags for status chips.
-- While not-yet-updated code still writes the vendors columns, a trigger copies
-- those writes across. Phase 2 (after the app reads the new table) clears and
-- locks the old columns.

create table if not exists public.vendor_financial_details (
  vendor_id            uuid primary key references public.vendors(id) on delete cascade,
  -- No FK to portfolios on purpose: a second vendors<->portfolios path would make
  -- existing PostgREST embeds ambiguous (PGRST201).
  portfolio_id         uuid not null,
  taxpayer_id          text,
  tax_account_number   text,
  bank_routing_number  text,
  bank_account_number  text,
  updated_at           timestamptz not null default now(),
  updated_by           uuid
);
alter table public.vendor_financial_details enable row level security;
drop policy if exists vfd_finance_all on public.vendor_financial_details;
create policy vfd_finance_all on public.vendor_financial_details for all to authenticated
  using (public.can_manage_finance(portfolio_id) or public.is_platform_operator())
  with check (public.can_manage_finance(portfolio_id) or public.is_platform_operator());
revoke all on public.vendor_financial_details from anon;
grant select, insert, update, delete on public.vendor_financial_details to authenticated;

alter table public.vendors
  add column if not exists has_taxpayer_id boolean not null default false,
  add column if not exists has_bank_account boolean not null default false;

-- Flags on vendors follow the private row.
create or replace function public.vendor_financial_details_sync_flags()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v uuid := coalesce(new.vendor_id, old.vendor_id);
begin
  update public.vendors
     set has_taxpayer_id = coalesce(tg_op <> 'DELETE' and nullif(btrim(new.taxpayer_id), '') is not null, false),
         has_bank_account = coalesce(tg_op <> 'DELETE' and nullif(btrim(new.bank_routing_number), '') is not null
                                     and nullif(btrim(new.bank_account_number), '') is not null, false)
   where id = v;
  return null;
end $$;
drop trigger if exists trg_vfd_sync_flags on public.vendor_financial_details;
create trigger trg_vfd_sync_flags after insert or update or delete on public.vendor_financial_details
  for each row execute function public.vendor_financial_details_sync_flags();

-- Transition: writes that still land on the old vendors columns are copied over.
create or replace function public.vendors_copy_financials_to_private()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if tg_op = 'INSERT'
     or new.taxpayer_id is distinct from old.taxpayer_id or new.tax_account_number is distinct from old.tax_account_number
     or new.bank_routing_number is distinct from old.bank_routing_number or new.bank_account_number is distinct from old.bank_account_number then
    if new.taxpayer_id is not null or new.tax_account_number is not null
       or new.bank_routing_number is not null or new.bank_account_number is not null or tg_op = 'UPDATE' then
      insert into public.vendor_financial_details (vendor_id, portfolio_id, taxpayer_id, tax_account_number, bank_routing_number, bank_account_number, updated_by)
      values (new.id, new.portfolio_id, new.taxpayer_id, new.tax_account_number, new.bank_routing_number, new.bank_account_number, auth.uid())
      on conflict (vendor_id) do update
        set taxpayer_id = excluded.taxpayer_id, tax_account_number = excluded.tax_account_number,
            bank_routing_number = excluded.bank_routing_number, bank_account_number = excluded.bank_account_number,
            updated_at = now(), updated_by = excluded.updated_by;
    end if;
  end if;
  return null;
end $$;
drop trigger if exists trg_vendors_copy_financials on public.vendors;
create trigger trg_vendors_copy_financials after insert or update of taxpayer_id, tax_account_number, bank_routing_number, bank_account_number on public.vendors
  for each row execute function public.vendors_copy_financials_to_private();

-- Backfill.
insert into public.vendor_financial_details (vendor_id, portfolio_id, taxpayer_id, tax_account_number, bank_routing_number, bank_account_number)
select id, portfolio_id, taxpayer_id, tax_account_number, bank_routing_number, bank_account_number
  from public.vendors
 where portfolio_id is not null
   and (taxpayer_id is not null or tax_account_number is not null or bank_routing_number is not null or bank_account_number is not null)
on conflict (vendor_id) do nothing;
update public.vendors v
   set has_taxpayer_id = nullif(btrim(coalesce(v.taxpayer_id, '')), '') is not null,
       has_bank_account = nullif(btrim(coalesce(v.bank_routing_number, '')), '') is not null
                          and nullif(btrim(coalesce(v.bank_account_number, '')), '') is not null;
