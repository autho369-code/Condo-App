-- Follow-ups from the Codex review of the 2026-10-04 audit fixes.

-- 1. approval_requests: an owner's request must name one of their own units
--    (or none), and the requester name and email come from their profile, so
--    a request can't be attributed to another resident.
alter policy approval_requests_insert_guard on public.approval_requests
  with check (
    public.can_access_portfolio(portfolio_id)
    or (
      owner_id is not null
      and owner_id = public.current_owner_id()
      and association_id in (select public.current_resident_association_ids())
      and (unit_id is null or unit_id in (select public.current_resident_unit_ids()))
      and portfolio_id = (select a.portfolio_id from public.associations a where a.id = association_id)
      and status = 'pending'
      and coalesce(votes_for, 0) = 0 and coalesce(votes_against, 0) = 0 and coalesce(votes_abstain, 0) = 0
      and coalesce(cardinality(board_member_ids), 0) = 0
      and decision_by is null and decision_at is null
    )
  );

create or replace function public.approval_requests_owner_identity()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is not null and new.owner_id is not null and not public.can_access_portfolio(new.portfolio_id) then
    select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.display_name), ''), p.email), p.email
      into new.requested_by_name, new.requested_by_email
      from public.profiles p where p.id = auth.uid();
  end if;
  return new;
end $$;
revoke all on function public.approval_requests_owner_identity() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'approval_requests_owner_identity' and tgrelid = 'public.approval_requests'::regclass) then
    create trigger approval_requests_owner_identity before insert on public.approval_requests
      for each row execute function public.approval_requests_owner_identity();
  end if;
end $$;

-- 2. bank_transfers scope: the policy asks a yes/no question instead of
--    calling a helper that returns another row's association id, and that
--    helper is no longer callable through the API.
create or replace function public.app_can_view_bank_account(p_bank_account_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
  select public.can_view_association_row(
    (select ba.association_id from public.bank_accounts ba where ba.id = p_bank_account_id));
$function$;
revoke all on function public.app_can_view_bank_account(uuid) from public, anon;
grant execute on function public.app_can_view_bank_account(uuid) to authenticated;

alter policy mgr_assoc_scope on public.bank_transfers
  using (public.app_can_view_bank_account(from_bank_account_id) and public.app_can_view_bank_account(to_bank_account_id));

revoke all on function public.app_bank_account_association_id(uuid) from public, anon, authenticated;

-- 3. get_budget_vs_actuals: include an unbudgeted account whenever it has
--    activity in any month, even if the year nets to zero (an expense
--    reversed later still belongs on the report).
create or replace function public.get_budget_vs_actuals(p_association_id uuid, p_fiscal_year integer)
 returns table(budget_line_id uuid, gl_account_id uuid, gl_account_number integer, gl_account_name text, category text, notes text, monthly_budget numeric[], monthly_actuals numeric[], monthly_variance numeric[], annual_budget numeric, annual_actual numeric, annual_variance numeric, annual_variance_pct numeric)
 language plpgsql
 stable security definer
 set search_path to 'pg_catalog', 'public'
as $function$
declare w record;
begin
  if p_association_id is null or p_fiscal_year is null or p_fiscal_year not between 1900 and 2200 then
    raise exception 'Invalid budget scope' using errcode = '22023';
  end if;
  if not public.can_read_association_budget(p_association_id) then
    raise exception 'Not authorized for this association budget' using errcode = '42501';
  end if;
  select * into w from public.association_fiscal_window(p_association_id, p_fiscal_year);

  return query
  with act as (
    select jl.gl_account_id as gid, public.fiscal_month_index(w.period_start, je.entry_date) as idx,
           sum(public.gl_normal_amount(ga.account_type::text, jl.debit_amount, jl.credit_amount)) as amt
      from public.journal_lines jl
      join public.journal_entries je on je.id = jl.entry_id and je.posted
      join public.gl_accounts ga on ga.id = jl.gl_account_id
     where jl.association_id = p_association_id and je.entry_date between w.period_start and w.period_end
     group by 1, 2
  ), budgeted as (
    select bl.id, bl.gl_account_id, ga.number as gl_number, ga.name as gl_name, bl.category::text as category,
           bl.notes, bl.monthly_amounts::numeric[] as monthly_amounts
      from public.budget_lines bl
      join public.gl_accounts ga on ga.id = bl.gl_account_id
      join public.associations a on a.id = bl.association_id
     where bl.association_id = p_association_id and bl.fiscal_year = p_fiscal_year
       and ga.portfolio_id = a.portfolio_id and (ga.association_id is null or ga.association_id = bl.association_id)
  ), unbudgeted as (
    select null::uuid as id, ga.id as gl_account_id, ga.number as gl_number, ga.name as gl_name,
           public.gl_section(ga.account_type::text) as category, null::text as notes,
           array_fill(0::numeric, array[12]) as monthly_amounts
      from public.gl_accounts ga
     where ga.id in (select act.gid from act group by act.gid having bool_or(act.amt <> 0))
       and public.gl_section(ga.account_type::text) in ('income', 'expense')
       and not exists (select 1 from budgeted b where b.gl_account_id = ga.id)
  ), lines as (
    select x.*,
           (select array_agg(coalesce(a.amt, 0) order by g.i) from generate_series(1, 12) g(i)
              left join act a on a.gid = x.gl_account_id and a.idx = g.i) as actuals
      from (select * from budgeted union all select * from unbudgeted) x
  )
  select l.id, l.gl_account_id, l.gl_number, l.gl_name, l.category, l.notes,
         l.monthly_amounts, l.actuals,
         (select array_agg(l.actuals[i] - coalesce(l.monthly_amounts[i], 0) order by i) from generate_series(1, 12) i),
         (select sum(x) from unnest(l.monthly_amounts) x),
         (select sum(x) from unnest(l.actuals) x),
         (select sum(x) from unnest(l.actuals) x) - (select sum(x) from unnest(l.monthly_amounts) x),
         case when (select sum(x) from unnest(l.monthly_amounts) x) <> 0
              then round(((select sum(x) from unnest(l.actuals) x) - (select sum(x) from unnest(l.monthly_amounts) x))
                         / (select sum(x) from unnest(l.monthly_amounts) x) * 100, 1)
              else 0 end
    from lines l
   order by l.gl_number;
end $function$;
