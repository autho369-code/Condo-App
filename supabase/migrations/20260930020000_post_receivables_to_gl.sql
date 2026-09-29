-- Owner receivables → general ledger ("GL engine", sub-ledger posting).
--
-- Until now only bills, checks, transfers and manual journal entries reached
-- the GL. Owner charges and payments lived only in the receivables
-- sub-ledger, so the balance sheet, income statement, budget vs actual and
-- year-end packages were missing all assessment income and owner cash.
--
-- Posting rules (accrual basis):
--   charge  : Dr Accounts Receivable        Cr income account of the charge
--   payment : Dr cash (the payment's bank)   Cr Accounts Receivable
-- Negative amounts (credits/refunds) post with the sides swapped.
-- Every entry carries source_type 'charge' / 'payment' and source_id, so an
-- edit or delete posts a reversal of what was posted for that source and
-- (for edits) a fresh entry — posted history is never rewritten.
-- Closed accounting periods are enforced by the existing guard: a charge or
-- payment dated in a closed month cannot be created, changed or deleted.
--
-- Account resolution (first match wins):
--   AR     : association-scoped A/R account, else the portfolio's lowest-
--            numbered A/R account (never an allowance account)
--   income : charge.gl_account_id → charge category GL → a late-fee income
--            account for late fees → the lowest-numbered income account
--   cash   : payment.bank_account_id's GL → the association's operating bank
--            GL → an "Undeposited Funds" cash account → lowest cash account

-- Receipt methods staff actually record at the office (AppFolio parity).
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check check (method = any (array[
  'manual', 'check', 'ach', 'card', 'other', 'cash', 'money_order', 'cashiers_check', 'wire', 'online'
]));

create or replace function public.unit_association_id(p_unit_id uuid)
returns uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select b.association_id from public.units u join public.buildings b on b.id = u.building_id where u.id = p_unit_id;
$$;

create or replace function public.gl_pick(p_portfolio uuid, p_association uuid, p_types text[], p_name_like text default null, p_exclude_like text default null)
returns uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select g.id from public.gl_accounts g
   where g.portfolio_id = p_portfolio and g.active
     and g.account_type::text = any (p_types)
     and (g.association_id is null or g.association_id = p_association)
     and (p_name_like is null or g.name ilike p_name_like)
     and (p_exclude_like is null or g.name not ilike p_exclude_like)
   order by (g.association_id is null), g.number
   limit 1;
$$;

-- Post one balanced two-line entry. Negative amounts swap the sides.
create or replace function public.post_subledger_entry(
  p_portfolio uuid, p_association uuid, p_date date, p_source_type text, p_source_id uuid,
  p_memo text, p_debit_gl uuid, p_credit_gl uuid, p_amount numeric)
returns uuid
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_id uuid; v_amt numeric := round(coalesce(p_amount, 0), 2); v_dr uuid := p_debit_gl; v_cr uuid := p_credit_gl;
begin
  if v_amt = 0 then return null; end if;
  if v_dr is null or v_cr is null then
    raise exception 'Cannot post % to the general ledger: set up % for this association', p_source_type,
      case when v_dr is null then 'the debit account' else 'the credit account' end using errcode = '22023';
  end if;
  if v_amt < 0 then v_amt := -v_amt; v_dr := p_credit_gl; v_cr := p_debit_gl; end if;
  insert into public.journal_entries (portfolio_id, entry_date, memo, description, source_type, source_id, posted, created_by)
  values (p_portfolio, coalesce(p_date, current_date), left(p_memo, 500), left(p_memo, 500), p_source_type, p_source_id, false, auth.uid())
  returning id into v_id;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order) values
    (v_id, v_dr, p_association, v_amt, 0, left(p_memo, 500), 0),
    (v_id, v_cr, p_association, 0, v_amt, left(p_memo, 500), 1);
  update public.journal_entries set posted = true where id = v_id;
  return v_id;
end $$;

-- Reverse everything posted so far for a source (net per account).
create or replace function public.reverse_subledger_source(p_source_type text, p_source_id uuid, p_date date, p_memo text)
returns uuid
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_id uuid; v_portfolio uuid;
begin
  select je.portfolio_id into v_portfolio from public.journal_entries je
   where je.source_type = p_source_type and je.source_id = p_source_id and je.posted limit 1;
  if v_portfolio is null then return null; end if;
  if not exists (
    select 1 from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
     where je.source_type = p_source_type and je.source_id = p_source_id and je.posted
     group by jl.gl_account_id, jl.association_id having sum(jl.debit_amount - jl.credit_amount) <> 0) then
    return null;
  end if;
  insert into public.journal_entries (portfolio_id, entry_date, memo, description, source_type, source_id, posted, created_by)
  values (v_portfolio, coalesce(p_date, current_date), left(p_memo, 500), left(p_memo, 500), p_source_type, p_source_id, false, auth.uid())
  returning id into v_id;
  insert into public.journal_lines (entry_id, gl_account_id, association_id, debit_amount, credit_amount, memo, sort_order)
  select v_id, x.gl, x.aid, greatest(-x.net, 0), greatest(x.net, 0), left(p_memo, 500), row_number() over () - 1
    from (select jl.gl_account_id gl, jl.association_id aid, sum(jl.debit_amount - jl.credit_amount) net
            from public.journal_lines jl join public.journal_entries je on je.id = jl.entry_id
           where je.source_type = p_source_type and je.source_id = p_source_id and je.posted and je.id <> v_id
           group by 1, 2 having sum(jl.debit_amount - jl.credit_amount) <> 0) x;
  update public.journal_entries set posted = true where id = v_id;
  return v_id;
end $$;

create or replace function public.charge_gl_accounts(p_charge public.charges, out portfolio_id uuid, out association_id uuid, out ar uuid, out income uuid)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_assoc uuid; v_portfolio uuid; v_cat_gl uuid;
begin
  v_assoc := public.unit_association_id(p_charge.unit_id);
  select a.portfolio_id into v_portfolio from public.associations a where a.id = v_assoc;
  select cc.gl_account_id into v_cat_gl from public.charge_categories cc where cc.id = p_charge.charge_category_id;
  portfolio_id := v_portfolio;
  association_id := v_assoc;
  ar := public.gl_pick(v_portfolio, v_assoc, array['accounts_receivable'], null, '%allowance%');
  income := coalesce(
    case when public.budget_gl_account_scope_valid(v_assoc, p_charge.gl_account_id) then p_charge.gl_account_id end,
    case when public.budget_gl_account_scope_valid(v_assoc, v_cat_gl) then v_cat_gl end,
    case when p_charge.charge_type::text = 'late_fee' then public.gl_pick(v_portfolio, v_assoc, array['income'], '%late fee%') end,
    public.gl_pick(v_portfolio, v_assoc, array['income']));
end $$;

create or replace function public.payment_gl_accounts(p_payment public.payments, out portfolio_id uuid, out association_id uuid, out cash uuid, out ar uuid)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_assoc uuid; v_portfolio uuid;
begin
  v_assoc := public.unit_association_id(p_payment.unit_id);
  select a.portfolio_id into v_portfolio from public.associations a where a.id = v_assoc;
  portfolio_id := v_portfolio;
  association_id := v_assoc;
  ar := public.gl_pick(v_portfolio, v_assoc, array['accounts_receivable'], null, '%allowance%');
  if p_payment.bank_account_id is not null and not exists (
       select 1 from public.bank_accounts ba where ba.id = p_payment.bank_account_id and ba.association_id = v_assoc) then
    raise exception 'That bank account belongs to a different association' using errcode = '22023';
  end if;
  cash := coalesce(
    (select ba.gl_account_id from public.bank_accounts ba where ba.id = p_payment.bank_account_id and ba.gl_account_id is not null),
    (select ba.gl_account_id from public.bank_accounts ba
      where ba.association_id = v_assoc and ba.gl_account_id is not null and ba.archived_at is null
      order by (ba.fund_type is distinct from 'operating'), ba.created_at limit 1),
    public.gl_pick(v_portfolio, v_assoc, array['cash'], '%undeposited%'),
    public.gl_pick(v_portfolio, v_assoc, array['cash']));
end $$;

create or replace function public.post_charge_to_gl()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare g record; v_memo text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if tg_op = 'UPDATE' and new.amount is not distinct from old.amount and new.gl_account_id is not distinct from old.gl_account_id
       and new.unit_id is not distinct from old.unit_id and new.due_date is not distinct from old.due_date
       and new.charge_category_id is not distinct from old.charge_category_id then
      return new;
    end if;
    perform public.reverse_subledger_source('charge', old.id, coalesce(old.due_date, current_date),
      format('Reversal: %s', coalesce(old.description, 'charge')));
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select * into g from public.charge_gl_accounts(new);
    if g.portfolio_id is null then return new; end if;
    v_memo := coalesce(new.description, new.charge_type::text);
    perform public.post_subledger_entry(g.portfolio_id, g.association_id, coalesce(new.due_date, current_date),
      'charge', new.id, v_memo, g.ar, g.income, new.amount);
    return new;
  end if;
  return old;
end $$;

create or replace function public.post_payment_to_gl()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare g record; v_memo text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if tg_op = 'UPDATE' and new.amount is not distinct from old.amount and new.unit_id is not distinct from old.unit_id
       and new.payment_date is not distinct from old.payment_date and new.bank_account_id is not distinct from old.bank_account_id then
      return new;
    end if;
    perform public.reverse_subledger_source('payment', old.id, coalesce(old.payment_date, current_date),
      format('Reversal: payment %s', coalesce(old.reference, old.method, '')));
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    select * into g from public.payment_gl_accounts(new);
    if g.portfolio_id is null then return new; end if;
    v_memo := btrim(format('Owner payment %s %s', coalesce(new.method, ''), coalesce(new.reference, '')));
    perform public.post_subledger_entry(g.portfolio_id, g.association_id, coalesce(new.payment_date, current_date),
      'payment', new.id, v_memo, g.cash, g.ar, new.amount);
    return new;
  end if;
  return old;
end $$;

drop trigger if exists trg_post_charge_to_gl on public.charges;
create trigger trg_post_charge_to_gl after insert or update or delete on public.charges
  for each row execute function public.post_charge_to_gl();
drop trigger if exists trg_post_payment_to_gl on public.payments;
create trigger trg_post_payment_to_gl after insert or update or delete on public.payments
  for each row execute function public.post_payment_to_gl();

-- Back-post existing sub-ledger rows that never reached the GL (service
-- role only; run once per association after review).
create or replace function public.backfill_receivables_to_gl(p_association_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare r public.charges; rp public.payments; g record; n_c integer := 0; n_p integer := 0;
begin
  for r in select c.* from public.charges c
            where public.unit_association_id(c.unit_id) = p_association_id
              and not exists (select 1 from public.journal_entries je where je.source_type = 'charge' and je.source_id = c.id)
            order by c.due_date, c.created_at loop
    select * into g from public.charge_gl_accounts(r);
    perform public.post_subledger_entry(g.portfolio_id, g.association_id, coalesce(r.due_date, r.created_at::date),
      'charge', r.id, coalesce(r.description, r.charge_type::text), g.ar, g.income, r.amount);
    n_c := n_c + 1;
  end loop;
  for rp in select p.* from public.payments p
            where public.unit_association_id(p.unit_id) = p_association_id
              and not exists (select 1 from public.journal_entries je where je.source_type = 'payment' and je.source_id = p.id)
            order by p.payment_date, p.created_at loop
    select * into g from public.payment_gl_accounts(rp);
    perform public.post_subledger_entry(g.portfolio_id, g.association_id, coalesce(rp.payment_date, rp.created_at::date),
      'payment', rp.id, btrim(format('Owner payment %s %s', coalesce(rp.method, ''), coalesce(rp.reference, ''))), g.cash, g.ar, rp.amount);
    n_p := n_p + 1;
  end loop;
  return jsonb_build_object('charges_posted', n_c, 'payments_posted', n_p);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.unit_association_id(uuid)', 'public.gl_pick(uuid, uuid, text[], text, text)',
    'public.post_subledger_entry(uuid, uuid, date, text, uuid, text, uuid, uuid, numeric)',
    'public.reverse_subledger_source(text, uuid, date, text)',
    'public.charge_gl_accounts(public.charges)', 'public.payment_gl_accounts(public.payments)',
    'public.post_charge_to_gl()', 'public.post_payment_to_gl()', 'public.backfill_receivables_to_gl(uuid)'
  ] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
