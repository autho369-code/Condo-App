-- AppFolio-parity audit items 2.1/2.2/2.3/2.4/2.7/2.8:
-- owner tax/payout/accounting-prefs (finance-staff-only), ad-hoc owner
-- attachments, per-owner packet settings, and field-level audit logging
-- on owners + owner_financial_details (sensitive values redacted).
-- Applied to prod 2026-07-07 via MCP (owner_financials_attachments_packets_audit).

create or replace function public.log_owner_audit() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_changes jsonb;
  v_entity uuid;
  v_row jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object(
      'from', case when n.key in ('taxpayer_id','bank_account_number','bank_routing_number') then '"[redacted]"'::jsonb else o.value end,
      'to',   case when n.key in ('taxpayer_id','bank_account_number','bank_routing_number') then '"[redacted]"'::jsonb else n.value end))
      into v_changes
    from jsonb_each(to_jsonb(old)) o
    join jsonb_each(to_jsonb(new)) n on n.key = o.key
    where o.value is distinct from n.value and n.key not in ('updated_at','updated_by');
    if v_changes is null then return new; end if;
  end if;
  v_row := to_jsonb(coalesce(new, old));
  if tg_table_name = 'owners' then
    v_entity := (v_row->>'id')::uuid;
  else
    v_entity := (v_row->>'owner_id')::uuid;
  end if;
  insert into public.audit_logs (entity_type, entity_id, action, actor_id, actor_email, changes)
  values ('owner', v_entity, lower(tg_op) || case when tg_table_name <> 'owners' then ':' || tg_table_name else '' end,
          auth.uid(), (select email from auth.users where id = auth.uid()), v_changes);
  return coalesce(new, old);
end $$;

create table public.owner_financial_details (
  owner_id uuid primary key references public.owners(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  taxpayer_name text, taxpayer_id text, tax_form_account_number text,
  send_1099 boolean not null default false,
  electronic_1099_consent boolean not null default false,
  sending_preference_1099 text not null default 'paper' check (sending_preference_1099 in ('paper','electronic')),
  paid_by_ach boolean not null default false,
  bank_routing_number text, bank_account_number text,
  check_consolidation text not null default 'single_check' check (check_consolidation in ('single_check','separate_checks')),
  check_stub_show_detail boolean not null default true,
  hold_payments boolean not null default false,
  email_echeck_receipt boolean not null default false,
  default_check_memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.owner_financial_details enable row level security;
create policy ofd_finance_all on public.owner_financial_details
  for all using (public.can_manage_finance(portfolio_id) or public.is_platform_operator())
  with check (public.can_manage_finance(portfolio_id) or public.is_platform_operator());

create table public.owner_attachments (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  owner_id uuid not null references public.owners(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index owner_attachments_owner_idx on public.owner_attachments(owner_id);
alter table public.owner_attachments enable row level security;
create policy oa_staff_all on public.owner_attachments
  for all using ((public.is_any_staff() or public.is_company_admin()) and public.can_access_portfolio(portfolio_id))
  with check ((public.is_any_staff() or public.is_company_admin()) and public.can_access_portfolio(portfolio_id));

create table public.owner_packet_settings (
  owner_id uuid primary key references public.owners(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  frequency text not null default 'monthly' check (frequency in ('monthly','quarterly','semiannual','annual')),
  delivery text not null default 'email' check (delivery in ('email','paper','both')),
  statement_template text not null default 'standard' check (statement_template in ('standard','enhanced')),
  include_statement boolean not null default true,
  include_ledger_detail boolean not null default true,
  include_delinquency boolean not null default true,
  include_documents boolean not null default false,
  include_violations boolean not null default false,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.owner_packet_settings enable row level security;
create policy ops_staff_all on public.owner_packet_settings
  for all using ((public.is_any_staff() or public.is_company_admin()) and public.can_access_portfolio(portfolio_id))
  with check ((public.is_any_staff() or public.is_company_admin()) and public.can_access_portfolio(portfolio_id));

create trigger trg_owners_audit after update on public.owners
  for each row execute function public.log_owner_audit();
create trigger trg_ofd_audit after insert or update on public.owner_financial_details
  for each row execute function public.log_owner_audit();
