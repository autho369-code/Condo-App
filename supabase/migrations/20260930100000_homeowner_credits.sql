-- Homeowner credits (AppFolio "Homeowner Credit" / "Apply Credits"): a
-- non-cash reduction of a homeowner's balance — waived late fee, concession,
-- insurance reimbursement credited to the account, board-approved write-off.
-- Stored as a payments row with method 'credit' so it applies to open charges
-- exactly like a receipt (oldest / association policy, or one chosen charge),
-- and any unused credit auto-applies to the next charge. In the ledger it posts
-- Dr <chosen credit account> / Cr Accounts Receivable instead of touching cash,
-- and it never appears in bank deposits or the receipts register.

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method = any (array['manual','check','ach','card','other','cash','money_order','cashiers_check','wire','online','credit']));

alter table public.payments add constraint payments_credit_needs_account
  check (method <> 'credit' or gl_account_id is not null) not valid;
alter table public.payments validate constraint payments_credit_needs_account;

create or replace function public.payment_gl_accounts(p_payment payments, OUT portfolio_id uuid, OUT association_id uuid, OUT cash uuid, OUT ar uuid)
returns record language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_assoc uuid; v_portfolio uuid;
begin
  v_assoc := public.unit_association_id(p_payment.unit_id);
  select a.portfolio_id into v_portfolio from public.associations a where a.id = v_assoc;
  portfolio_id := v_portfolio;
  association_id := v_assoc;
  ar := public.gl_pick(v_portfolio, v_assoc, array['accounts_receivable'], null, '%allowance%');
  if p_payment.method = 'credit' then
    -- Non-cash credit: debit the account staff chose (e.g. late fee income, bad debt).
    cash := p_payment.gl_account_id;
    return;
  end if;
  cash := coalesce(
    (select ba.gl_account_id from public.bank_accounts ba where ba.id = p_payment.bank_account_id and ba.gl_account_id is not null),
    (select ba.gl_account_id from public.bank_accounts ba
      where ba.association_id = v_assoc and ba.gl_account_id is not null and ba.archived_at is null
      order by (ba.fund_type is distinct from 'operating'), ba.created_at limit 1),
    public.gl_pick(v_portfolio, v_assoc, array['cash'], '%undeposited%'),
    public.gl_pick(v_portfolio, v_assoc, array['cash']));
end $$;

create or replace function public.post_homeowner_credit(
  p_unit_id uuid, p_amount numeric, p_credit_date date, p_gl_account_id uuid, p_memo text, p_charge_id uuid default null)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_assoc uuid := public.unit_association_id(p_unit_id);
  v_pid uuid;
  v_open numeric;
  v_id uuid;
begin
  select a.portfolio_id into v_pid from public.associations a where a.id = v_assoc;
  if v_pid is null or not public.can_manage_finance(v_pid) or not public.can_access_association(v_assoc) then
    raise exception 'Unit not found' using errcode = 'P0002';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter a credit amount greater than zero' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_memo, ''))) = 0 then raise exception 'Say why the credit is given' using errcode = '22023'; end if;
  if not exists (select 1 from public.gl_accounts g where g.id = p_gl_account_id and g.portfolio_id = v_pid and g.active
                   and (g.association_id is null or g.association_id = v_assoc)
                   and g.account_type::text in ('income', 'other_income', 'expense', 'other_expense')) then
    raise exception 'Choose an income or expense account for the credit' using errcode = '22023';
  end if;
  if p_charge_id is not null then
    select c.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = c.id), 0)
      into v_open from public.charges c where c.id = p_charge_id and c.unit_id = p_unit_id;
    if v_open is null then raise exception 'Charge not found on this unit' using errcode = 'P0002'; end if;
    if p_amount > v_open then
      raise exception 'The credit (%) is more than the open balance on that charge (%)', p_amount, v_open using errcode = '22023';
    end if;
  end if;

  insert into public.payments (unit_id, charge_id, amount, payment_date, method, reference, notes, gl_account_id, created_by)
  values (p_unit_id, p_charge_id, round(p_amount, 2), coalesce(p_credit_date, current_date), 'credit', 'Credit',
          btrim(p_memo), p_gl_account_id, auth.uid())
  returning id into v_id;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'unit', p_unit_id, 'homeowner_credit_posted', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('payment_id', v_id, 'amount', round(p_amount, 2), 'gl_account_id', p_gl_account_id,
                             'charge_id', p_charge_id, 'memo', btrim(p_memo)));
  return v_id;
end $$;

do $$
begin
  alter function public.post_homeowner_credit(uuid, numeric, date, uuid, text, uuid) owner to postgres;
  revoke all on function public.post_homeowner_credit(uuid, numeric, date, uuid, text, uuid) from public, anon;
  grant execute on function public.post_homeowner_credit(uuid, numeric, date, uuid, text, uuid) to authenticated, service_role;
end $$;

-- Credits are not money received: keep them out of the deposit and payment registers.
do $$
declare f text; v_def text;
begin
  foreach f in array array['public.report_data_deposit_register(uuid, jsonb)', 'public.report_data_payment_register(uuid, jsonb)'] loop
    select pg_get_functiondef(f::regprocedure) into v_def;
    if position('join public.payments p on p.unit_id = u.id' in v_def) = 0 then raise exception '% join not found', f; end if;
    v_def := replace(v_def, 'join public.payments p on p.unit_id = u.id', 'join public.payments p on p.unit_id = u.id and p.method <> ''credit''');
    execute v_def;
  end loop;
end $$;
