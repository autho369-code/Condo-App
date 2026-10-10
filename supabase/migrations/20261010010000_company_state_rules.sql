-- Company state rules: each management company records the rules it follows
-- in each state where it manages associations (collection protections plus
-- any other state requirements in plain words). Company admins edit them;
-- the company's managers read them. A company's rule for a state takes
-- precedence over the built-in collection_jurisdiction_profiles row when it
-- is applied to an association's collection policy.

create table if not exists public.company_state_rules (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  pre_referral_notice_days integer not null default 30 check (pre_referral_notice_days between 0 and 180),
  notice_method text not null default 'certified_mail' check (notice_method in ('first_class', 'certified_mail')),
  payment_plan_offer_required boolean not null default false,
  payment_plan_min_months integer check (payment_plan_min_months is null or payment_plan_min_months between 1 and 60),
  board_vote_required boolean not null default true,
  foreclosure_min_balance numeric(12,2) check (foreclosure_min_balance is null or foreclosure_min_balance >= 0),
  foreclosure_min_months integer check (foreclosure_min_months is null or foreclosure_min_months between 0 and 120),
  summary text not null check (char_length(btrim(summary)) between 1 and 2000),
  other_rules text check (other_rules is null or char_length(other_rules) <= 10000),
  citations text[] not null default '{}' check (cardinality(citations) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  unique (portfolio_id, state_code)
);

comment on table public.company_state_rules is
  'Rules a management company follows in one state (collection protections + other state requirements). Edited by company admins, read by the company''s staff; preferred over collection_jurisdiction_profiles when applied to an association.';

alter table public.company_state_rules enable row level security;

drop policy if exists company_state_rules_read on public.company_state_rules;
create policy company_state_rules_read on public.company_state_rules
  for select to authenticated using (public.can_access_portfolio(portfolio_id));

drop policy if exists company_state_rules_insert on public.company_state_rules;
create policy company_state_rules_insert on public.company_state_rules
  for insert to authenticated with check (public.can_admin_portfolio(portfolio_id));

drop policy if exists company_state_rules_update on public.company_state_rules;
create policy company_state_rules_update on public.company_state_rules
  for update to authenticated
  using (public.can_admin_portfolio(portfolio_id))
  with check (public.can_admin_portfolio(portfolio_id));

drop policy if exists company_state_rules_delete on public.company_state_rules;
create policy company_state_rules_delete on public.company_state_rules
  for delete to authenticated using (public.can_admin_portfolio(portfolio_id));

revoke all on public.company_state_rules from anon;
grant select, insert, update, delete on public.company_state_rules to authenticated;

-- Who changed it and when: set by the database, never by the form.
create or replace function public.company_state_rules_touch()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.portfolio_id := old.portfolio_id;
    new.state_code := old.state_code;
    new.created_at := old.created_at;
  else
    new.created_at := now();
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$function$;

revoke all on function public.company_state_rules_touch() from public, anon, authenticated;

drop trigger if exists trg_company_state_rules_touch on public.company_state_rules;
create trigger trg_company_state_rules_touch
  before insert or update on public.company_state_rules
  for each row execute function public.company_state_rules_touch();

-- Every add, change and removal goes to the company's audit log.
create or replace function public.company_state_rules_audit()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_row public.company_state_rules := coalesce(new, old);
begin
  -- Rows removed with their company (on delete cascade) leave no log entry.
  if tg_op = 'DELETE' and not exists (select 1 from public.portfolios p where p.id = old.portfolio_id) then
    return null;
  end if;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (v_row.portfolio_id, 'company_state_rule', v_row.id,
          case tg_op when 'INSERT' then 'state_rule_added' when 'UPDATE' then 'state_rule_updated' else 'state_rule_removed' end,
          auth.uid(),
          jsonb_build_object('state_code', v_row.state_code,
                             'before', case when tg_op <> 'INSERT' then to_jsonb(old) end,
                             'after', case when tg_op <> 'DELETE' then to_jsonb(new) end));
  return null;
end;
$function$;

revoke all on function public.company_state_rules_audit() from public, anon, authenticated;

drop trigger if exists trg_company_state_rules_audit on public.company_state_rules;
create trigger trg_company_state_rules_audit
  after insert or update or delete on public.company_state_rules
  for each row execute function public.company_state_rules_audit();

-- Applying a state to an association's collection policy uses the company's
-- own rule for that state first, then the built-in profile, then DEFAULT.
create or replace function public.apply_delinquency_jurisdiction(p_association_id uuid, p_state_code text)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_portfolio uuid;
  v_code text := upper(btrim(coalesce(p_state_code, '')));
  v_rule record;
  v_policy uuid;
begin
  select portfolio_id into v_portfolio from public.associations where id = p_association_id;
  if v_portfolio is null then raise exception 'Association not found'; end if;
  if not (public.can_admin_portfolio(v_portfolio) or public.is_platform_operator()) then
    raise exception 'Only a portfolio administrator may change collection compliance settings';
  end if;

  select x.* into v_rule from (
    select r.state_code, r.pre_referral_notice_days, r.notice_method, r.payment_plan_offer_required,
           r.payment_plan_min_months, r.board_vote_required, r.foreclosure_min_balance, r.foreclosure_min_months,
           'company'::text as source, 1 as rank
      from public.company_state_rules r
     where r.portfolio_id = v_portfolio and r.state_code = v_code
    union all
    select p.state_code, p.pre_referral_notice_days, p.notice_method, p.payment_plan_offer_required,
           p.payment_plan_min_months, p.board_vote_required, p.foreclosure_min_balance, p.foreclosure_min_months,
           'built_in'::text, 2
      from public.collection_jurisdiction_profiles p
     where p.state_code = v_code
    union all
    select p.state_code, p.pre_referral_notice_days, p.notice_method, p.payment_plan_offer_required,
           p.payment_plan_min_months, p.board_vote_required, p.foreclosure_min_balance, p.foreclosure_min_months,
           'built_in'::text, 3
      from public.collection_jurisdiction_profiles p
     where p.state_code = 'DEFAULT'
  ) x
  order by x.rank
  limit 1;
  if not found then raise exception 'No collection rules are set up'; end if;

  select id into v_policy from public.delinquency_policies where association_id = p_association_id;
  if v_policy is null then raise exception 'Initialize the association''s collection policy first'; end if;

  update public.delinquency_policies
     set jurisdiction = v_rule.state_code,
         pre_referral_notice_days = v_rule.pre_referral_notice_days,
         notice_method = v_rule.notice_method,
         payment_plan_offer_required = v_rule.payment_plan_offer_required,
         payment_plan_min_months = v_rule.payment_plan_min_months,
         board_vote_required = v_rule.board_vote_required,
         foreclosure_min_balance = v_rule.foreclosure_min_balance,
         foreclosure_min_months = v_rule.foreclosure_min_months,
         updated_at = now()
   where id = v_policy;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, changes)
  values (v_portfolio, 'association', p_association_id, 'delinquency_jurisdiction_applied', auth.uid(),
          jsonb_build_object('jurisdiction', v_rule.state_code, 'source', v_rule.source));
  return v_rule.state_code;
end;
$function$;

revoke all on function public.apply_delinquency_jurisdiction(uuid, text) from public, anon;
grant execute on function public.apply_delinquency_jurisdiction(uuid, text) to authenticated, service_role;
