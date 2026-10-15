-- Zelle owner payments.
--
-- Zelle has no API: owners send it to the association's own bank account and
-- the credit arrives through the bank feed (bank_transactions, Plaid). Staff
-- receive such a credit as an owner payment from the bank feed; the database
-- suggests the unit and staff always confirm (nothing is posted on its own).
--
-- Identification, in this order of confidence (inside the bank account's
-- association(s) only):
--   1. a remembered sender (payment_sender_aliases, saved when staff confirm)
--   2. a unit number in the memo, through the lockbox matcher (lockbox_match_unit)
--   3. the sender name against the names of the unit's current owners
--      (shared payer_name_matches helper, also used by the lockbox matcher now)
--   4. the amount equal to the unit's open balance (tie-breaker only)
--
-- Receiving inserts the payment through the normal receipt path (the payments
-- triggers apply it and post Dr bank / Cr A/R), puts it in a bank deposit on
-- that bank account (create_bank_deposit) and matches the feed line to the
-- deposit (match_bank_transaction_to_deposit).
--
-- Additive: new columns, one new table, new functions, a widened method check
-- (the constraint is replaced with a superset; no data changes) and
-- CREATE OR REPLACE of lockbox_match_unit and associations_payment_settings_guard.
-- No DELETE.

-- ---------------------------------------------------------------------------
-- 1. 'zelle' as a payment method (every existing value kept).
-- ---------------------------------------------------------------------------
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method = any (array['manual','check','ach','card','other','cash','money_order','cashiers_check','wire','online','credit','zelle']));

-- ---------------------------------------------------------------------------
-- 2. Raw bank description and payment details from Plaid. Written only by the
--    server (bank sync with the service role); signed-in users can't set them.
-- ---------------------------------------------------------------------------
alter table public.bank_transactions
  add column if not exists original_description text,
  add column if not exists payer_name text,
  add column if not exists payment_reason text;

create or replace function public.bank_transactions_server_fields_guard()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
begin
  -- SECURITY INVOKER: current_user is the caller's role. The service role and
  -- trusted definer functions pass.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.original_description is not null or new.payer_name is not null or new.payment_reason is not null then
      raise exception 'Bank details are filled in by the bank sync' using errcode = '42501';
    end if;
  elsif new.original_description is distinct from old.original_description
     or new.payer_name is distinct from old.payer_name
     or new.payment_reason is distinct from old.payment_reason then
    raise exception 'Bank details are filled in by the bank sync' using errcode = '42501';
  end if;
  return new;
end
$function$;
revoke all on function public.bank_transactions_server_fields_guard() from public, anon, authenticated;

create or replace trigger trg_bank_transactions_server_fields_guard
  before insert or update of original_description, payer_name, payment_reason on public.bank_transactions
  for each row execute function public.bank_transactions_server_fields_guard();

-- ---------------------------------------------------------------------------
-- 3. The association's Zelle recipient, shown to owners on the pay page.
--    Where owners send money is a finance decision (same rule as the
--    allocation order and settlement account, #391).
-- ---------------------------------------------------------------------------
alter table public.associations
  add column if not exists zelle_recipient text,
  add column if not exists zelle_recipient_name text;

alter table public.associations drop constraint if exists associations_zelle_recipient_check;
alter table public.associations add constraint associations_zelle_recipient_check check (
  zelle_recipient is null
  or zelle_recipient ~* '^[a-z0-9._%+''-]+@[a-z0-9.-]+\.[a-z]{2,}$'
  or zelle_recipient ~ '^\+?1?[2-9][0-9]{2}[2-9][0-9]{6}$'
) not valid;
alter table public.associations validate constraint associations_zelle_recipient_check;
alter table public.associations drop constraint if exists associations_zelle_recipient_name_check;
alter table public.associations add constraint associations_zelle_recipient_name_check check (
  zelle_recipient_name is null or char_length(zelle_recipient_name) between 1 and 120
) not valid;
alter table public.associations validate constraint associations_zelle_recipient_name_check;

create or replace function public.associations_payment_settings_guard()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.stripe_account_id is not null or coalesce(new.stripe_charges_enabled, false)
       or coalesce(new.stripe_payouts_enabled, false) or coalesce(new.stripe_details_submitted, false)
       or new.stripe_onboarded_at is not null or new.stripe_deauthorized_at is not null
       or new.stripe_disabled_reason is not null or new.stripe_last_status_at is not null then
      raise exception 'Online payment settings are set up from the association''s Payments tab' using errcode = '42501';
    end if;
  elsif new.stripe_account_id is distinct from old.stripe_account_id
     or new.stripe_charges_enabled is distinct from old.stripe_charges_enabled
     or new.stripe_payouts_enabled is distinct from old.stripe_payouts_enabled
     or new.stripe_details_submitted is distinct from old.stripe_details_submitted
     or new.stripe_onboarded_at is distinct from old.stripe_onboarded_at
     or new.stripe_deauthorized_at is distinct from old.stripe_deauthorized_at
     or new.stripe_disabled_reason is distinct from old.stripe_disabled_reason
     or new.stripe_last_status_at is distinct from old.stripe_last_status_at then
    raise exception 'Online payment settings are set up from the association''s Payments tab' using errcode = '42501';
  end if;

  if (tg_op = 'INSERT' and new.stripe_settlement_bank_account_id is not null)
     or (tg_op = 'UPDATE' and (
          new.payment_allocation_order is distinct from old.payment_allocation_order
       or new.stripe_settlement_bank_account_id is distinct from old.stripe_settlement_bank_account_id)) then
    if not (coalesce(public.is_finance_staff(), false)
            or coalesce(public.is_company_admin(), false)
            or coalesce(public.is_platform_operator(), false)) then
      raise exception 'Only finance staff can change how payments are applied or settled' using errcode = '42501';
    end if;
  end if;

  -- Where owners send Zelle payments: finance staff, company admins, operators.
  if (tg_op = 'INSERT' and (new.zelle_recipient is not null or new.zelle_recipient_name is not null))
     or (tg_op = 'UPDATE' and (
          new.zelle_recipient is distinct from old.zelle_recipient
       or new.zelle_recipient_name is distinct from old.zelle_recipient_name)) then
    if not (coalesce(public.is_finance_staff(), false)
            or coalesce(public.is_company_admin(), false)
            or coalesce(public.is_platform_operator(), false)) then
      raise exception 'Only finance staff can change where owners send Zelle payments' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;
revoke all on function public.associations_payment_settings_guard() from public, anon, authenticated;

-- Every change of where owners send money is recorded (who, old, new), for
-- every writer.
create or replace function public.associations_zelle_recipient_audit()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.zelle_recipient is distinct from old.zelle_recipient
     or new.zelle_recipient_name is distinct from old.zelle_recipient_name then
    insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
    values (new.portfolio_id, 'association', new.id, 'zelle_recipient_changed', auth.uid(),
            (select email from auth.users where id = auth.uid()),
            jsonb_build_object('old_recipient', old.zelle_recipient, 'new_recipient', new.zelle_recipient,
                               'old_name', old.zelle_recipient_name, 'new_name', new.zelle_recipient_name));
  end if;
  return null;
end
$function$;
revoke all on function public.associations_zelle_recipient_audit() from public, anon, authenticated;

create or replace trigger trg_associations_zelle_recipient_audit
  after update of zelle_recipient, zelle_recipient_name on public.associations
  for each row execute function public.associations_zelle_recipient_audit();

-- ---------------------------------------------------------------------------
-- 4. Remembered senders: normalized sender name -> unit, per association.
--    Read by finance staff; written only by receive_bank_transaction_as_payment.
-- ---------------------------------------------------------------------------
create table if not exists public.payment_sender_aliases (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  association_id uuid not null references public.associations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  sender_key text not null check (char_length(sender_key) between 1 and 200),
  created_by uuid,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  constraint payment_sender_aliases_association_sender_key unique (association_id, sender_key)
);
create index if not exists payment_sender_aliases_unit_idx on public.payment_sender_aliases (unit_id);
create index if not exists payment_sender_aliases_portfolio_idx on public.payment_sender_aliases (portfolio_id);

alter table public.payment_sender_aliases enable row level security;
revoke all on table public.payment_sender_aliases from public, anon, authenticated;
grant select on table public.payment_sender_aliases to authenticated;
grant all on table public.payment_sender_aliases to service_role;

create or replace trigger operator_write_guard
  before insert or delete or update on public.payment_sender_aliases
  for each statement execute function public.operator_write_guard('false');

create policy payment_sender_aliases_finance_read on public.payment_sender_aliases
  as permissive for select to authenticated
  using (
    coalesce(portfolio_id = (select public.my_finance_portfolio()), false)
    or ((select public.is_platform_operator()) and portfolio_id is not null)
  );
create policy mgr_assoc_scope on public.payment_sender_aliases
  as restrictive for all to authenticated
  using (
    ((select public.manager_is_scoped()) is not true)
    or association_id is null
    or association_id in (select public.my_managed_association_ids())
  );

-- ---------------------------------------------------------------------------
-- 5. Parsing helpers.
-- ---------------------------------------------------------------------------
-- Upper case, punctuation to spaces, spaces collapsed.
create or replace function public.payment_sender_key(p_name text)
returns text
language plpgsql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
begin
  return nullif(btrim(regexp_replace(regexp_replace(upper(coalesce(p_name, '')), '[^A-Z0-9 ]+', ' ', 'g'), '\s+', ' ', 'g')), '');
end
$function$;

-- Sender name, memo and reference from a bank's description of an incoming
-- transfer. Formats seen:
--   Zelle Payment From JOHN SMITH Dfs0Kbd1                    (Chase)
--   Zelle payment from JANE DOE for "4B"; Conf# 99cim759h     (Bank of America)
--   ZELLE FROM JOHN DOE ON 10/01 REF # X                      (Wells Fargo)
--   Zelle From Name                                           (Capital One)
--   Zelle Name Transfer                                       (PNC)
create or replace function public.parse_bank_payment_description(p_text text,
  out sender text, out memo text, out reference text)
language plpgsql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
declare
  s text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
  v_rest text;
  v_pos int;
  v_prev text;
begin
  if s = '' then return; end if;

  memo := nullif(btrim(substring(s from '"([^"]*)"')), '');
  if memo is null then
    memo := nullif(btrim(substring(s from '(?i)\mmemo\M\s*:?\s*([^;]+)')), '');
  end if;
  reference := nullif(btrim(substring(s from '(?i)(?:\mconf(?:irmation)?|\mref(?:erence)?)\s*(?:#|no\.?|number)?\s*:?\s*([A-Za-z0-9]+)')), '');

  v_pos := position(' from ' in lower(' ' || s || ' '));
  if v_pos > 0 then
    v_rest := substr(s, v_pos + 5);
  elsif s ~* '^zelle\s' then
    -- PNC: "Zelle NAME Transfer"
    v_rest := regexp_replace(s, '^zelle\s+', '', 'i');
    v_rest := regexp_replace(v_rest, '(?i)\s+(transfer|payment|credit)\M.*$', '');
  else
    return;
  end if;

  v_rest := regexp_replace(v_rest, '[;"].*$', '');
  v_rest := regexp_replace(v_rest, '(?i)\s+(for|on|ref|reference|conf|confirmation|memo)\M.*$', '');
  v_rest := regexp_replace(v_rest, '(?i)\s+(transfer|payment)$', '');
  -- Drop trailing confirmation codes and dates (a name has no digits).
  loop
    v_prev := v_rest;
    v_rest := regexp_replace(v_rest, '\s+\S*[0-9]\S*$', '');
    exit when v_rest = v_prev;
  end loop;
  if v_rest ~ '[0-9]' and v_rest !~ '\s' then v_rest := ''; end if;
  sender := nullif(btrim(regexp_replace(v_rest, '[,.]+$', '')), '');
end
$function$;

-- Does a payer name name this owner? Either order (FIRST LAST / LAST FIRST /
-- LAST, FIRST), middle names and initials ignored, a name cut short by the
-- bank at the end (at least 3 letters), or the whole name equal. Owner
-- records that hold two people ("Peter & Thomas Muntz", "Loren Kronemeyer &
-- Chrishantha Vedhanayagam") match either person.
create or replace function public.payer_name_matches(p_payer text, p_first text, p_last text, p_full text)
returns boolean
language plpgsql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_payer text := public.payment_sender_key(p_payer);
  v_full text := public.payment_sender_key(p_full);
  v_tokens text[];
  v_head text[];
  v_tail text;
  v_n int;
  v_pairs text[][] := '{}';
  v_last text;
  v_part text;
  v_words text[];
  v_parts text[];
  v_shared_last text;
  f text;
  l text;
  i int;
begin
  if v_payer is null then return false; end if;
  if v_full is not null and v_payer = v_full then return true; end if;
  -- Words of two letters or more, without suffixes and titles.
  select coalesce(array_agg(w), '{}') into v_tokens
    from unnest(string_to_array(v_payer, ' ')) w
   where char_length(w) >= 2 and w not in ('JR', 'SR', 'II', 'III', 'IV', 'MR', 'MRS', 'MS', 'DR', 'AND');
  v_n := cardinality(v_tokens);
  if v_n < 2 then return false; end if;
  v_head := v_tokens[1:v_n - 1];
  v_tail := v_tokens[v_n];

  -- (first, last) pairs: each first-name word with the last name's last word.
  v_last := public.payment_sender_key(p_last);
  if v_last is not null then
    v_words := string_to_array(v_last, ' ');
    v_last := v_words[cardinality(v_words)];
    foreach f in array coalesce(string_to_array(public.payment_sender_key(p_first), ' '), '{}') loop
      if char_length(f) >= 2 and f <> 'AND' then v_pairs := v_pairs || array[[f, v_last]]; end if;
    end loop;
  end if;
  -- And each person named in the full name ("A & B", "A and B", "A / B").
  if v_full is not null then
    v_parts := regexp_split_to_array(upper(p_full), '\s*(?:&|/|\mAND\M|\+)\s*');
    v_words := string_to_array(public.payment_sender_key(v_parts[cardinality(v_parts)]), ' ');
    v_shared_last := v_words[cardinality(v_words)];
    foreach v_part in array v_parts loop
      v_words := coalesce(string_to_array(public.payment_sender_key(v_part), ' '), '{}');
      if cardinality(v_words) >= 2 then
        v_pairs := v_pairs || array[[v_words[1], v_words[cardinality(v_words)]]];
      elsif cardinality(v_words) = 1 and v_shared_last is not null then
        v_pairs := v_pairs || array[[v_words[1], v_shared_last]];
      end if;
    end loop;
  end if;

  for i in 1 .. coalesce(array_length(v_pairs, 1), 0) loop
    f := v_pairs[i][1];
    l := v_pairs[i][2];
    continue when f is null or l is null or f = l or char_length(f) < 2 or char_length(l) < 2;
    if f = any (v_tokens) and l = any (v_tokens) then return true; end if;
    -- Cut short at the end: the payer's last word starts the other name.
    if char_length(v_tail) >= 3 then
      if f = any (v_head) and char_length(v_tail) < char_length(l) and left(l, char_length(v_tail)) = v_tail then return true; end if;
      if l = any (v_head) and char_length(v_tail) < char_length(f) and left(f, char_length(v_tail)) = v_tail then return true; end if;
    end if;
  end loop;
  return false;
end
$function$;

-- The associations a bank account serves: its own, or (a company-wide account)
-- those that name it as their operating, reserve or primary account.
create or replace function public.app_bank_account_association_ids(p_bank_account_id uuid)
returns uuid[]
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare b public.bank_accounts; v uuid[];
begin
  select * into b from public.bank_accounts where id = p_bank_account_id;
  if b.id is null then return '{}'; end if;
  if b.association_id is not null then return array[b.association_id]; end if;
  select coalesce(array_agg(a.id), '{}') into v
    from public.associations a
   where a.portfolio_id = b.portfolio_id and a.archived_at is null
     and b.id in (a.operating_bank_account_id, a.reserve_bank_account_id, a.primary_bank_account_id);
  return v;
end
$function$;

-- The lockbox matcher, with its name step on the shared helper (either order,
-- middle initials, truncated last names). Unit number and amount steps unchanged.
create or replace function public.lockbox_match_unit(p_association_id uuid, p_unit text, p_payer text, p_amount numeric,
                                                    out unit_id uuid, out owner_id uuid, out confidence numeric, out reason text)
language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_payer text := lower(regexp_replace(btrim(coalesce(p_payer, '')), '\s+', ' ', 'g')); v_n int;
begin
  if btrim(coalesce(p_unit, '')) <> '' then
    select count(*) into v_n from public.units u join public.buildings b on b.id = u.building_id
     where b.association_id = p_association_id and u.archived_at is null and lower(u.unit_number) = lower(btrim(p_unit));
    if v_n = 1 then
      select u.id into unit_id from public.units u join public.buildings b on b.id = u.building_id
       where b.association_id = p_association_id and u.archived_at is null and lower(u.unit_number) = lower(btrim(p_unit));
      confidence := 0.95; reason := 'Unit number';
    end if;
  end if;

  if unit_id is null and v_payer <> '' then
    select count(distinct occ.unit_id) into v_n
      from public.occupancies occ join public.owners o on o.id = occ.owner_id
     where occ.association_id = p_association_id and occ.status = 'current' and occ.occupancy_type = 'owner'
       and public.payer_name_matches(p_payer, o.first_name, o.last_name, o.full_name);
    if v_n = 1 then
      select occ.unit_id into unit_id
        from public.occupancies occ join public.owners o on o.id = occ.owner_id
       where occ.association_id = p_association_id and occ.status = 'current' and occ.occupancy_type = 'owner'
         and public.payer_name_matches(p_payer, o.first_name, o.last_name, o.full_name)
       limit 1;
      confidence := 0.80; reason := 'Owner name';
    end if;
  end if;

  if unit_id is null and p_amount > 0 then
    with bal as (
      select c.unit_id, sum(c.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = c.id), 0)) as open
        from public.charges c join public.units u on u.id = c.unit_id join public.buildings b on b.id = u.building_id
       where b.association_id = p_association_id and u.archived_at is null
       group by c.unit_id)
    select count(*) into v_n from bal where round(open, 2) = round(p_amount, 2);
    if v_n = 1 then
      with bal as (
        select c.unit_id, sum(c.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = c.id), 0)) as open
          from public.charges c join public.units u on u.id = c.unit_id join public.buildings b on b.id = u.building_id
         where b.association_id = p_association_id and u.archived_at is null
         group by c.unit_id)
      select bal.unit_id into unit_id from bal where round(open, 2) = round(p_amount, 2);
      confidence := 0.50; reason := 'Amount matches balance';
    end if;
  end if;

  if unit_id is not null then
    select occ.owner_id into owner_id from public.occupancies occ
     where occ.unit_id = lockbox_match_unit.unit_id and occ.status = 'current' and occ.occupancy_type = 'owner'
     order by occ.is_primary desc nulls last limit 1;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Suggest the unit for an incoming bank transaction.
-- ---------------------------------------------------------------------------
create or replace function public.suggest_bank_transaction_payment(p_id uuid)
returns table (unit_id uuid, unit_label text, owner_name text, confidence numeric, reason text)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
#variable_conflict use_column
declare
  t public.bank_transactions;
  b public.bank_accounts;
  v_assocs uuid[];
  p record;
  m record;
  r record;
  v_sender text;
  v_key text;
  v_amount numeric;
  v_tokens text[];
  v_tok text;
  v_assoc uuid;
  v_found boolean := false;
  v_n int;
  v_names jsonb;
  c jsonb := '{}'::jsonb;  -- unit_id -> {"c": confidence, "r": reason}
begin
  select * into t from public.bank_transactions bt where bt.id = p_id;
  if not found then raise exception 'Bank transaction not found' using errcode = 'P0002'; end if;
  select * into b from public.bank_accounts ba where ba.id = t.bank_account_id;
  if b.id is null or not public.can_manage_finance(b.portfolio_id)
     or (b.association_id is not null and not public.can_view_association_row(b.association_id)) then
    raise exception 'Bank transaction not found' using errcode = 'P0002';
  end if;
  -- Only money coming in that is still open.
  if t.amount is null or t.amount >= 0 or t.pending or t.ignored_at is not null or t.matched_at is not null
     or t.matched_journal_line_id is not null or t.matched_bank_deposit_id is not null then
    return;
  end if;
  select coalesce(array_agg(x), '{}') into v_assocs
    from unnest(public.app_bank_account_association_ids(b.id)) x
   where public.can_view_association_row(x);
  if cardinality(v_assocs) = 0 then return; end if;

  v_amount := round(-t.amount, 2);
  select * into p from public.parse_bank_payment_description(coalesce(nullif(btrim(t.original_description), ''), t.name));
  v_sender := coalesce(nullif(btrim(t.payer_name), ''), p.sender);
  v_key := public.payment_sender_key(v_sender);
  -- A remembered sender is a name of two words or more: a single word
  -- ("CHK" from "ONLINE TRANSFER FROM CHK 1234") would match unrelated credits.
  if position(' ' in coalesce(v_key, '')) = 0 then v_key := null; end if;

  -- 1. Remembered sender.
  if v_key is not null then
    for r in
      select a.unit_id, a.last_used_at,
             exists (select 1 from public.occupancies o
                      where o.unit_id = a.unit_id and o.status = 'current' and o.occupancy_type = 'owner'
                        and o.move_in_date > a.last_used_at::date) as new_owner
        from public.payment_sender_aliases a join public.units u on u.id = a.unit_id
       where a.association_id = any (v_assocs) and a.sender_key = v_key and u.archived_at is null
    loop
      if r.new_owner then
        c := c || jsonb_build_object(r.unit_id::text, jsonb_build_object('c', 0.60, 'r', 'Remembered sender (the unit has a new owner since)'));
      else
        c := c || jsonb_build_object(r.unit_id::text, jsonb_build_object('c', 0.98, 'r', 'Remembered sender'));
      end if;
    end loop;
  end if;

  -- 2. Unit number in the memo (the lockbox matcher's unit step).
  if nullif(btrim(coalesce(p.memo, t.payment_reason, '')), '') is not null then
    v_tok := btrim(coalesce(p.memo, t.payment_reason));
    v_tokens := array[v_tok];
    v_tokens := v_tokens || coalesce((select array_agg(x[1]) from regexp_matches(v_tok, '(?:unit|apt|apartment|suite|ste|#)\s*#?\s*([A-Za-z0-9-]+)', 'gi') x), '{}');
    v_tokens := v_tokens || coalesce((select array_agg(w) from (select w from unnest(regexp_split_to_array(v_tok, '[\s,;:#]+')) w where w <> '' limit 8) s), '{}');
    <<tokens>>
    foreach v_tok in array v_tokens loop
      foreach v_assoc in array v_assocs loop
        select * into m from public.lockbox_match_unit(v_assoc, v_tok, null, null);
        if m.unit_id is not null and m.reason = 'Unit number' then
          if coalesce((c -> m.unit_id::text ->> 'c')::numeric, 0) < 0.95 then
            c := c || jsonb_build_object(m.unit_id::text, jsonb_build_object('c', 0.95, 'r', format('Unit number in the memo (%s)', v_tok)));
          end if;
          v_found := true;
        end if;
      end loop;
      exit tokens when v_found;
    end loop;
  end if;

  -- 3. Sender name against the current owners' names.
  if v_sender is not null then
    -- One pass over the current owners (at most 10 matching units kept).
    select coalesce(jsonb_agg(jsonb_build_object('u', m2.unit_id, 'n', m2.full_name)), '[]'::jsonb) into v_names
      from (select o.unit_id, min(w.full_name) as full_name
              from public.occupancies o join public.owners w on w.id = o.owner_id
             where o.association_id = any (v_assocs) and o.status = 'current' and o.occupancy_type = 'owner'
               and public.payer_name_matches(v_sender, w.first_name, w.last_name, w.full_name)
             group by o.unit_id
             limit 10) m2;
    v_n := jsonb_array_length(v_names);
    for r in select x ->> 'u' as unit_id, x ->> 'n' as full_name from jsonb_array_elements(v_names) x loop
      if coalesce((c -> r.unit_id ->> 'c')::numeric, 0) < (case when v_n = 1 then 0.80 else 0.60 end) then
        c := c || jsonb_build_object(r.unit_id, jsonb_build_object(
               'c', case when v_n = 1 then 0.80 else 0.60 end,
               'r', format('Sender name matches owner %s', r.full_name)));
      end if;
    end loop;
  end if;

  -- 4. Amount equal to the open balance: a tie-breaker for the candidates
  --    above, or on its own when it points at exactly one unit.
  if c <> '{}'::jsonb then
    for r in
      select k.key::uuid as unit_id
        from jsonb_each(c) k
       where round(coalesce((select sum(ch.amount - coalesce((select sum(pa.amount_applied) from public.payment_applications pa where pa.charge_id = ch.id), 0))
                               from public.charges ch where ch.unit_id = k.key::uuid), 0), 2) = v_amount
    loop
      c := jsonb_set(c, array[r.unit_id::text], jsonb_build_object(
             'c', least(0.99, (c -> r.unit_id::text ->> 'c')::numeric + 0.04),
             'r', (c -> r.unit_id::text ->> 'r') || ' ' || chr(183) || ' amount equals the open balance'));
    end loop;
  else
    foreach v_assoc in array v_assocs loop
      select * into m from public.lockbox_match_unit(v_assoc, null, null, v_amount);
      if m.unit_id is not null then
        c := c || jsonb_build_object(m.unit_id::text, jsonb_build_object('c', 0.50, 'r', 'Amount equals the open balance'));
      end if;
    end loop;
  end if;

  return query
    select u.id,
           case when cardinality(v_assocs) > 1 then format('Unit %s %s %s', u.unit_number, chr(183), a.name) else format('Unit %s', u.unit_number) end,
           (select string_agg(w.full_name, ' & ' order by o.is_primary desc nulls last, w.full_name)
              from public.occupancies o join public.owners w on w.id = o.owner_id
             where o.unit_id = u.id and o.status = 'current' and o.occupancy_type = 'owner'),
           (k.value ->> 'c')::numeric,
           k.value ->> 'r'
      from jsonb_each(c) k
      join public.units u on u.id = k.key::uuid
      join public.buildings bl on bl.id = u.building_id
      join public.associations a on a.id = bl.association_id
     where bl.association_id = any (v_assocs) and u.archived_at is null
     order by (k.value ->> 'c')::numeric desc, u.unit_number
     limit 10;
end
$function$;

-- The bank feed page asks for every open line in one call (one connection,
-- not one request per line). Lines the caller can't see are skipped.
create or replace function public.suggest_bank_transaction_payments(p_ids uuid[])
returns table (transaction_id uuid, unit_id uuid, unit_label text, owner_name text, confidence numeric, reason text)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare v_id uuid;
begin
  if p_ids is null then return; end if;
  if cardinality(p_ids) > 100 then
    raise exception 'Ask for at most 100 bank transactions at a time' using errcode = '22023';
  end if;
  foreach v_id in array p_ids loop
    begin
      return query select v_id, s.unit_id, s.unit_label, s.owner_name, s.confidence, s.reason
                     from public.suggest_bank_transaction_payment(v_id) s;
    exception when sqlstate 'P0002' then
      null;  -- not found or not the caller's: no suggestions
    end;
  end loop;
end
$function$;

-- ---------------------------------------------------------------------------
-- 7. Receive an incoming bank transaction as an owner payment.
-- ---------------------------------------------------------------------------
create or replace function public.receive_bank_transaction_as_payment(p_id uuid, p_unit_id uuid, p_remember_sender boolean default true)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  t public.bank_transactions;
  b public.bank_accounts;
  v_assocs uuid[];
  v_unit_assoc uuid;
  v_desc text;
  p record;
  v_sender text;
  v_key text;
  v_method text;
  v_conf numeric;
  v_reason text;
  v_payment uuid;
  v_deposit uuid;
begin
  -- Locks the line (FOR UPDATE), checks finance access and association scope,
  -- refuses pending or already matched lines.
  t := public.app_bank_transaction_for_update(p_id);
  if t.ignored_at is not null then
    raise exception 'This transaction is ignored: put it back in review first' using errcode = '22023';
  end if;
  if t.amount is null or t.amount >= 0 then
    raise exception 'Only money coming in can be received as an owner payment' using errcode = '22023';
  end if;
  select * into b from public.bank_accounts where id = t.bank_account_id;
  v_assocs := public.app_bank_account_association_ids(b.id);

  select bl.association_id into v_unit_assoc
    from public.units u join public.buildings bl on bl.id = u.building_id
   where u.id = p_unit_id and u.archived_at is null;
  if v_unit_assoc is null or not (v_unit_assoc = any (v_assocs)) or not public.can_view_association_row(v_unit_assoc) then
    raise exception 'Choose a unit in this bank account''s association' using errcode = '22023';
  end if;

  v_desc := coalesce(nullif(btrim(t.original_description), ''), t.name, '');
  select * into p from public.parse_bank_payment_description(v_desc);
  v_sender := coalesce(nullif(btrim(t.payer_name), ''), p.sender);
  v_key := public.payment_sender_key(v_sender);
  -- A remembered sender is a name of two words or more: a single word
  -- ("CHK" from "ONLINE TRANSFER FROM CHK 1234") would match unrelated credits.
  if position(' ' in coalesce(v_key, '')) = 0 then v_key := null; end if;
  v_method := case
    when v_desc ~* 'zelle' or coalesce(t.name, '') ~* 'zelle' then 'zelle'
    when v_desc ~* '\m(ach|ppd|ccd|web)\M' then 'ach'
    else 'other' end;

  select s.confidence, s.reason into v_conf, v_reason
    from public.suggest_bank_transaction_payment(t.id) s where s.unit_id = p_unit_id;

  -- The normal receipt path: the payments triggers apply it to the unit's
  -- charges and post Dr bank / Cr A/R (closed periods refuse it there).
  insert into public.payments (unit_id, amount, payment_date, method, reference, notes, bank_account_id, created_by)
  values (p_unit_id, round(-t.amount, 2), t.date, v_method,
          left(coalesce(case when v_method = 'zelle' then 'Zelle' else 'Bank' end || ' ' || p.reference,
                        case when v_method = 'zelle' then 'Zelle' else 'Bank transfer' end), 100),
          left(btrim(concat_ws(' ' || chr(183) || ' ', 'Received from the bank feed', v_sender, nullif(btrim(coalesce(p.memo, t.payment_reason, '')), ''))), 1000),
          b.id, auth.uid())
  returning id into v_payment;

  v_deposit := public.create_bank_deposit(b.id, t.date, array[v_payment], null::uuid[], 'Owner payment received from the bank feed');
  perform public.match_bank_transaction_to_deposit(t.id, v_deposit);
  update public.bank_transactions
     set match_method = 'owner_payment', match_confidence = v_conf
   where id = t.id;

  if coalesce(p_remember_sender, true) and v_key is not null then
    insert into public.payment_sender_aliases (portfolio_id, association_id, unit_id, sender_key, created_by)
    values (b.portfolio_id, v_unit_assoc, p_unit_id, left(v_key, 200), auth.uid())
    on conflict (association_id, sender_key)
      do update set unit_id = excluded.unit_id, last_used_at = now();
  end if;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (b.portfolio_id, 'bank_transaction', t.id, 'received_as_owner_payment', auth.uid(),
          (select email from auth.users where id = auth.uid()),
          jsonb_build_object('payment_id', v_payment, 'bank_deposit_id', v_deposit, 'unit_id', p_unit_id,
                             'method', v_method, 'suggested', v_reason is not null, 'reason', v_reason,
                             'remembered_sender', coalesce(p_remember_sender, true) and v_key is not null));
  return v_payment;
end
$function$;

-- ---------------------------------------------------------------------------
-- 8. Grants.
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.suggest_bank_transaction_payment(uuid)',
    'public.suggest_bank_transaction_payments(uuid[])',
    'public.receive_bank_transaction_as_payment(uuid, uuid, boolean)'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.app_bank_account_association_ids(uuid)',
    'public.lockbox_match_unit(uuid, text, text, numeric)'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  -- Text helpers, called only by the functions above.
  foreach f in array array[
    'public.payment_sender_key(text)',
    'public.parse_bank_payment_description(text)',
    'public.payer_name_matches(text, text, text, text)'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  alter function public.bank_transactions_server_fields_guard() owner to postgres;
  alter function public.associations_zelle_recipient_audit() owner to postgres;
end $$;
