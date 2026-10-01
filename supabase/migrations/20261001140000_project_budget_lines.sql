-- Project cost categories (AppFolio: project budget by cost category, budget vs. actual).
-- Each budget line is a named category tied to an expense GL account. Actual cost per line is
-- the approved/paid bills on the project's linked work orders coded to that account; spend on
-- accounts with no line shows as "Other".

create table if not exists public.capital_project_budget_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.capital_projects(id) on delete cascade,
  category text not null check (length(btrim(category)) between 1 and 120),
  gl_account_id uuid not null references public.gl_accounts(id),
  budget_amount numeric(14, 2) not null check (budget_amount >= 0),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, gl_account_id)
);

alter table public.capital_project_budget_lines enable row level security;

drop policy if exists capital_project_budget_lines_staff_read on public.capital_project_budget_lines;
create policy capital_project_budget_lines_staff_read on public.capital_project_budget_lines
  for select to authenticated using (exists (
    select 1 from public.capital_projects p
     where p.id = capital_project_budget_lines.project_id
       and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
       and public.can_access_portfolio(p.portfolio_id)));
drop policy if exists capital_project_budget_lines_board_read on public.capital_project_budget_lines;
create policy capital_project_budget_lines_board_read on public.capital_project_budget_lines
  for select to authenticated using (exists (
    select 1 from public.capital_projects p
     where p.id = capital_project_budget_lines.project_id and public.is_board_user()
       and p.association_id in (select public.current_board_association_ids()) and p.status <> 'planning'));
-- Writes go through save_project_budget_line / delete_project_budget_line.

create or replace function public.save_project_budget_line(
  p_project_id uuid, p_id uuid, p_category text, p_gl_account_id uuid, p_budget_amount numeric)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  p public.capital_projects;
  v_id uuid := p_id;
begin
  select * into p from public.capital_projects where id = p_project_id and archived_at is null;
  if not found or not public.can_manage_finance(p.portfolio_id) or not public.can_manage_association(p.association_id) then
    raise exception 'Project not found' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_category, ''))) = 0 then raise exception 'Name the cost category' using errcode = '22023'; end if;
  if p_budget_amount is null or p_budget_amount < 0 then raise exception 'Enter a budget of zero or more' using errcode = '22023'; end if;
  if p_gl_account_id is null or not exists (
    select 1 from public.gl_accounts g
     where g.id = p_gl_account_id and g.portfolio_id = p.portfolio_id and g.active
       and (g.association_id is null or g.association_id = p.association_id)
       and g.account_type::text in ('expense', 'other_expense', 'cost_of_goods_sold', 'fixed_asset', 'asset')) then
    raise exception 'Choose an expense or asset account for this association' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.capital_project_budget_lines (project_id, category, gl_account_id, budget_amount, sort_order, created_by)
    values (p.id, left(btrim(p_category), 120), p_gl_account_id, round(p_budget_amount, 2),
            coalesce((select max(sort_order) + 1 from public.capital_project_budget_lines where project_id = p.id), 0), auth.uid())
    returning id into v_id;
  else
    update public.capital_project_budget_lines
       set category = left(btrim(p_category), 120), gl_account_id = p_gl_account_id,
           budget_amount = round(p_budget_amount, 2), updated_at = now()
     where id = v_id and project_id = p.id;
    if not found then raise exception 'Budget line not found' using errcode = 'P0002'; end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'This project already has a line for that account' using errcode = '23505';
end $function$;

grant execute on function public.save_project_budget_line(uuid, uuid, text, uuid, numeric) to authenticated;

create or replace function public.delete_project_budget_line(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  p public.capital_projects;
begin
  select cp.* into p from public.capital_projects cp
    join public.capital_project_budget_lines l on l.project_id = cp.id where l.id = p_id;
  if not found or not public.can_manage_finance(p.portfolio_id) or not public.can_manage_association(p.association_id) then
    raise exception 'Budget line not found' using errcode = '42501';
  end if;
  delete from public.capital_project_budget_lines where id = p_id;
end $function$;

grant execute on function public.delete_project_budget_line(uuid) to authenticated;

-- Budget vs. actual by cost category for one project. Reads with the caller's RLS.
create or replace function public.project_budget_vs_actual(p_project_id uuid)
returns table (line_id uuid, category text, gl_account_id uuid, gl_label text, budget_amount numeric, actual_amount numeric)
language sql
stable
security invoker
set search_path to 'pg_catalog', 'public'
as $function$
  with spend as (
    select b.gl_account_id, sum(b.amount) as amount
      from public.capital_project_work_orders link
      join public.payable_bills b on b.work_order_id = link.work_order_id
     where link.project_id = p_project_id and b.archived_at is null
       and b.status::text in ('approved', 'paid')
     group by b.gl_account_id
  )
  select x.line_id, x.category, x.gl_account_id, x.gl_label, x.budget_amount, x.actual_amount
    from (
      select l.id as line_id, l.category, l.gl_account_id, concat_ws(' ', g.number, g.name) as gl_label,
             l.budget_amount, coalesce(s.amount, 0)::numeric(14, 2) as actual_amount, l.sort_order as ord
        from public.capital_project_budget_lines l
        left join public.gl_accounts g on g.id = l.gl_account_id
        left join spend s on s.gl_account_id = l.gl_account_id
       where l.project_id = p_project_id
      union all
      select null, 'Other', null, null, 0::numeric, sum(s.amount)::numeric(14, 2), 2147483647
        from spend s
       where not exists (select 1 from public.capital_project_budget_lines l
                          where l.project_id = p_project_id and l.gl_account_id is not distinct from s.gl_account_id)
      having sum(s.amount) is not null
    ) x
   order by x.ord, x.category;
$function$;

grant execute on function public.project_budget_vs_actual(uuid) to authenticated;
