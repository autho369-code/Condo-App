-- #87 review fixes, round 3.
-- 1. Payments only for ACTIVE loans (a refinanced loan with a balance was
--    still payable).
-- 2. A loan with recorded payments can't move to another association (its
--    payments and journal lines belong to the original one).
-- 3. Voiding order uses a real recording sequence, assigned while the loan row
--    is locked, instead of transaction timestamps.
-- 4. Payment dates before 2000 are rejected (typos like 0026-10-01).

create sequence if not exists public.loan_payments_recorded_seq;
alter table public.loan_payments add column if not exists recorded_seq bigint;
update public.loan_payments p
   set recorded_seq = s.n
  from (select id, row_number() over (order by created_at, id) as n from public.loan_payments) s
 where s.id = p.id and p.recorded_seq is null;
select setval('public.loan_payments_recorded_seq', greatest(coalesce((select max(recorded_seq) from public.loan_payments), 0), 1));
alter table public.loan_payments alter column recorded_seq set default nextval('public.loan_payments_recorded_seq');
alter table public.loan_payments alter column recorded_seq set not null;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.association_loans_bind()'::regprocedure);
  if def !~ 'v_moved := tg_op = ''INSERT'' or new\.association_id is distinct from old\.association_id;' then
    raise exception 'loan_review_fixes_3: association_loans_bind drifted';
  end if;
  def := regexp_replace(def, '(v_moved := tg_op = ''INSERT'' or new\.association_id is distinct from old\.association_id;)',
    '\1' || chr(10) ||
    '  if tg_op = ''UPDATE'' and new.association_id is distinct from old.association_id' || chr(10) ||
    '     and exists (select 1 from public.loan_payments p where p.loan_id = old.id) then' || chr(10) ||
    '    raise exception ''This loan has recorded payments in its association''''s ledger — it can''''t be moved to another association'' using errcode = ''22023'';' || chr(10) ||
    '  end if;');
  execute def;

  def := pg_get_functiondef('public.record_loan_payment(uuid, date, numeric, numeric, uuid, text, text)'::regprocedure);
  if def !~ 'if coalesce\(l\.current_balance, 0\) <= 0 then' or def !~ 'p_payment_date > current_date \+ 31' then
    raise exception 'loan_review_fixes_3: record_loan_payment drifted';
  end if;
  def := regexp_replace(def, 'if coalesce\(l\.current_balance, 0\) <= 0 then',
    'if coalesce(l.status, ''active'') <> ''active'' then' || chr(10) ||
    '    raise exception ''Payments can only be recorded on active loans (this one is %)'', replace(l.status, ''_'', '' '') using errcode = ''22023'';' || chr(10) ||
    '  end if;' || chr(10) ||
    '  if coalesce(l.current_balance, 0) <= 0 then');
  def := regexp_replace(def, 'p_payment_date > current_date \+ 31',
    'p_payment_date > current_date + 31 or p_payment_date < date ''2000-01-01''');
  execute def;

  def := pg_get_functiondef('public.void_loan_payment(uuid, text)'::regprocedure);
  if def !~ 'and \(x\.created_at, x\.id\) > \(p\.created_at, p\.id\)' then
    raise exception 'loan_review_fixes_3: void_loan_payment drifted';
  end if;
  def := regexp_replace(def, 'and \(x\.created_at, x\.id\) > \(p\.created_at, p\.id\)', 'and x.recorded_seq > p.recorded_seq');
  execute def;
end $$;
