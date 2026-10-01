-- Credit card accounts (AppFolio: Financial Accounts → Credit Card Accounts,
-- report "Credit Card Expense Detail").
-- A card is a financial account tied to a liability GL account (e.g. 2390
-- Credit Card Payable). Each card purchase posts Dr expense / Cr card
-- liability for its association; voiding posts the reversal. Paying the card
-- is an ordinary bill to the card issuer coded to the card's liability account.

create table if not exists public.credit_card_accounts (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid references public.associations(id) on delete cascade,
  name text not null,
  issuer text,
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  gl_account_id uuid not null references public.gl_accounts(id),
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists credit_card_accounts_portfolio_idx on public.credit_card_accounts (portfolio_id);

create table if not exists public.credit_card_charges (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  card_id uuid not null references public.credit_card_accounts(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  charge_date date not null,
  payee text not null,
  vendor_id uuid references public.vendors(id) on delete set null,
  gl_account_id uuid not null references public.gl_accounts(id),
  amount numeric(12, 2) not null check (amount > 0),
  reference text,
  description text,
  journal_entry_id uuid references public.journal_entries(id) on delete set null,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  void_reason text,
  void_journal_entry_id uuid references public.journal_entries(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists credit_card_charges_card_idx on public.credit_card_charges (card_id, charge_date desc);

alter table public.credit_card_accounts enable row level security;
alter table public.credit_card_charges enable row level security;
revoke all on public.credit_card_accounts, public.credit_card_charges from anon;

drop policy if exists credit_card_accounts_finance_read on public.credit_card_accounts;
create policy credit_card_accounts_finance_read on public.credit_card_accounts for select to authenticated
  using (public.can_manage_finance(portfolio_id) and (association_id is null or public.can_manage_association(association_id)));
drop policy if exists credit_card_charges_finance_read on public.credit_card_charges;
create policy credit_card_charges_finance_read on public.credit_card_charges for select to authenticated
  using (public.can_manage_finance(portfolio_id) and public.can_manage_association(association_id));

-- ------------------------------------------------------------ card accounts
create or replace function public.save_credit_card_account(
  p_card_id uuid, p_association_id uuid, p_name text, p_issuer text, p_last_four text, p_gl_account_id uuid)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  v_card public.credit_card_accounts;
  v_id uuid;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then
    raise exception 'You do not have accounting access' using errcode = '42501';
  end if;
  if p_association_id is not null and not exists (
       select 1 from public.associations a where a.id = p_association_id and a.portfolio_id = v_pid and a.archived_at is null
         and public.can_manage_association(a.id)) then
    raise exception 'Association not found' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Name the card account' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_last_four, '')), '') is not null and btrim(p_last_four) !~ '^[0-9]{4}$' then
    raise exception 'Enter only the last four digits of the card' using errcode = '22023';
  end if;
  if not exists (select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = v_pid and coalesce(g.active, true)
                   and g.account_type::text in ('liability', 'accounts_payable')
                   and (g.association_id is null or g.association_id is not distinct from p_association_id)) then
    raise exception 'Choose an active liability account for the card balance (e.g. Credit Card Payable)' using errcode = '22023';
  end if;

  if p_card_id is null then
    insert into public.credit_card_accounts (portfolio_id, association_id, name, issuer, last_four, gl_account_id, created_by)
    values (v_pid, p_association_id, btrim(p_name), nullif(btrim(coalesce(p_issuer, '')), ''),
            nullif(btrim(coalesce(p_last_four, '')), ''), p_gl_account_id, auth.uid())
    returning id into v_id;
    return v_id;
  end if;

  select * into v_card from public.credit_card_accounts where id = p_card_id for update;
  if v_card.id is null or v_card.portfolio_id <> v_pid
     or (v_card.association_id is not null and not public.can_manage_association(v_card.association_id)) then
    raise exception 'Card account not found' using errcode = '42501';
  end if;
  if exists (select 1 from public.credit_card_charges c where c.card_id = v_card.id)
     and (p_gl_account_id is distinct from v_card.gl_account_id or p_association_id is distinct from v_card.association_id) then
    raise exception 'This card has charges — its liability account and association can no longer change' using errcode = '22023';
  end if;
  update public.credit_card_accounts
     set association_id = p_association_id, name = btrim(p_name), issuer = nullif(btrim(coalesce(p_issuer, '')), ''),
         last_four = nullif(btrim(coalesce(p_last_four, '')), ''), gl_account_id = p_gl_account_id, updated_at = now()
   where id = v_card.id;
  return v_card.id;
end $$;

-- ------------------------------------------------------------ charges
create or replace function public.record_credit_card_charge(
  p_card_id uuid, p_association_id uuid, p_charge_date date, p_payee text, p_vendor_id uuid,
  p_gl_account_id uuid, p_amount numeric, p_reference text, p_description text)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_card public.credit_card_accounts;
  v_assoc uuid;
  v_payee text := nullif(btrim(coalesce(p_payee, '')), '');
  v_amt numeric := round(p_amount, 2);
  v_gl public.gl_accounts;
  v_charge uuid;
  v_entry uuid;
begin
  select * into v_card from public.credit_card_accounts where id = p_card_id and archived_at is null;
  if v_card.id is null or not public.can_manage_finance(v_card.portfolio_id) then
    raise exception 'Card account not found' using errcode = '42501';
  end if;
  v_assoc := coalesce(v_card.association_id, p_association_id);
  if v_assoc is null then
    raise exception 'Choose the association this purchase is for' using errcode = '22023';
  end if;
  if v_card.association_id is not null and p_association_id is not null and p_association_id <> v_card.association_id then
    raise exception 'This card belongs to another association' using errcode = '22023';
  end if;
  if not exists (select 1 from public.associations a where a.id = v_assoc and a.portfolio_id = v_card.portfolio_id and a.archived_at is null)
     or not public.can_manage_association(v_assoc) then
    raise exception 'Association not found' using errcode = '42501';
  end if;
  if p_charge_date is null or p_charge_date > current_date + 31 or p_charge_date < date '2000-01-01' then
    raise exception 'Enter a valid charge date' using errcode = '22023';
  end if;
  if v_amt is null or v_amt <= 0 or v_amt > 10000000 then
    raise exception 'Enter an amount greater than zero' using errcode = '22023';
  end if;
  if p_vendor_id is not null then
    select coalesce(v_payee, v.name) into v_payee from public.vendors v where v.id = p_vendor_id and v.portfolio_id = v_card.portfolio_id;
    if not found then raise exception 'Vendor not found' using errcode = '22023'; end if;
  end if;
  if v_payee is null then
    raise exception 'Enter who the card was charged by' using errcode = '22023';
  end if;
  select * into v_gl from public.gl_accounts g
   where g.id = p_gl_account_id and g.portfolio_id = v_card.portfolio_id and coalesce(g.active, true)
     and (g.association_id is null or g.association_id = v_assoc);
  if v_gl.id is null then
    raise exception 'GL account not found' using errcode = '22023';
  end if;
  if v_gl.id = v_card.gl_account_id or v_gl.account_type::text in ('cash', 'accounts_receivable', 'accounts_payable') then
    raise exception 'Choose the expense (or asset) account the purchase is for' using errcode = '22023';
  end if;

  insert into public.credit_card_charges (portfolio_id, card_id, association_id, charge_date, payee, vendor_id, gl_account_id,
                                          amount, reference, description, created_by)
  values (v_card.portfolio_id, v_card.id, v_assoc, p_charge_date, left(v_payee, 200), p_vendor_id, v_gl.id, v_amt,
          nullif(left(btrim(coalesce(p_reference, '')), 100), ''), nullif(left(btrim(coalesce(p_description, '')), 1000), ''), auth.uid())
  returning id into v_charge;

  insert into public.journal_entries (portfolio_id, entry_date, reference_number, description, memo, source_type, source_id, posted, created_by)
  values (v_card.portfolio_id, p_charge_date, nullif(left(btrim(coalesce(p_reference, '')), 100), ''),
          left(v_card.name || ' — ' || v_payee, 250), nullif(left(btrim(coalesce(p_description, '')), 1000), ''),
          'credit_card_charge', v_charge, false, auth.uid())
  returning id into v_entry;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  values (v_entry, v_gl.id, v_assoc, v_amt, 0, left(v_payee, 200), 0),
         (v_entry, v_card.gl_account_id, v_assoc, 0, v_amt, left(v_card.name || ' — ' || v_payee, 250), 1);
  update public.journal_entries set posted = true, posted_at = now() where id = v_entry;
  update public.credit_card_charges set journal_entry_id = v_entry where id = v_charge;
  return v_charge;
end $$;

create or replace function public.void_credit_card_charge(p_charge_id uuid, p_reason text)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  c public.credit_card_charges;
  v_entry uuid;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into c from public.credit_card_charges where id = p_charge_id for update;
  if c.id is null or not (public.can_manage_finance(c.portfolio_id) and public.can_manage_association(c.association_id)) then
    raise exception 'Charge not found' using errcode = '42501';
  end if;
  if c.voided_at is not null then
    raise exception 'This charge is already void' using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'Enter a reason for voiding' using errcode = '22023';
  end if;
  insert into public.journal_entries (portfolio_id, entry_date, reference_number, description, memo, source_type, source_id, posted, created_by)
  values (c.portfolio_id, current_date, 'VOID-' || coalesce(c.reference, left(c.id::text, 8)),
          left('Void: card charge ' || c.payee, 250), left(v_reason, 1000), 'credit_card_charge_void', c.id, false, auth.uid())
  returning id into v_entry;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  select v_entry, jl.gl_account_id, jl.association_id, jl.credit_amount, jl.debit_amount, 'Void: ' || coalesce(jl.memo, ''), jl.sort_order
    from public.journal_lines jl where jl.entry_id = c.journal_entry_id;
  update public.journal_entries set posted = true, posted_at = now() where id = v_entry;
  update public.credit_card_charges
     set voided_at = now(), voided_by = auth.uid(), void_reason = left(v_reason, 500), void_journal_entry_id = v_entry
   where id = c.id;
end $$;

revoke all on function public.save_credit_card_account(uuid, uuid, text, text, text, uuid) from public, anon;
grant execute on function public.save_credit_card_account(uuid, uuid, text, text, text, uuid) to authenticated, service_role;
revoke all on function public.record_credit_card_charge(uuid, uuid, date, text, uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.record_credit_card_charge(uuid, uuid, date, text, uuid, uuid, numeric, text, text) to authenticated, service_role;
revoke all on function public.void_credit_card_charge(uuid, text) from public, anon;
grant execute on function public.void_credit_card_charge(uuid, text) to authenticated, service_role;

-- ------------------------------------------------------------ report
create or replace function public.report_data_credit_card_expense_detail(p_portfolio_id uuid, p_params jsonb default '{}'::jsonb)
returns jsonb language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_agg(to_jsonb(r.*)), '[]'::jsonb) from (
    with prm as (select * from public.rpt_prm(p_params))
    select c.charge_date as date, k.name as card, k.last_four, a.name as association, c.payee,
           g.number as gl_account_number, g.name as gl_account, round(c.amount, 2) as amount, c.reference, c.description,
           case when c.voided_at is not null then 'Void' else 'Posted' end as status
      from public.credit_card_charges c
      cross join prm
      join public.credit_card_accounts k on k.id = c.card_id
      join public.associations a on a.id = c.association_id
      join public.gl_accounts g on g.id = c.gl_account_id
     where c.portfolio_id = p_portfolio_id and (prm.aid is null or c.association_id = prm.aid)
       and c.charge_date between prm.df and prm.dt
     order by c.charge_date desc, k.name
  ) r;
$$;
do $$
begin
  alter function public.report_data_credit_card_expense_detail(uuid, jsonb) owner to postgres;
  revoke all on function public.report_data_credit_card_expense_detail(uuid, jsonb) from public, anon, authenticated;
  grant execute on function public.report_data_credit_card_expense_detail(uuid, jsonb) to service_role;
end $$;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.report_data_dispatch(uuid, text, jsonb)'::regprocedure);
  if def !~ 'case p_slug' then
    raise exception 'credit_card_accounts: report_data_dispatch drifted';
  end if;
  def := regexp_replace(def, 'case p_slug',
    'case p_slug' || chr(10) ||
    '    when ''credit_card_expense_detail'' then return public.report_data_credit_card_expense_detail(p_portfolio_id, p_params);');
  execute def;
end $$;

insert into public.report_definitions (slug, name, category, description, parameter_schema, default_filters, output_formats, is_system, active)
values
  ('credit_card_expense_detail', 'Credit Card Expense Detail', 'accounting', 'Every credit card purchase in the period: card, association, payee, GL account and amount.', '{}', '{}', '{pdf,csv}', true, true);
