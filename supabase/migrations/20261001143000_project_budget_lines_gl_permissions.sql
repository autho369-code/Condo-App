-- Project cost categories honour role-based GL visibility (gl_account_role_permissions):
-- * direct reads of budget lines require can_read_gl on the line's account;
-- * project_budget_vs_actual folds lines and spend on accounts the caller can't read into a
--   single unnamed "Restricted accounts" row, so totals still reconcile without exposing them.

drop policy if exists capital_project_budget_lines_staff_read on public.capital_project_budget_lines;
create policy capital_project_budget_lines_staff_read on public.capital_project_budget_lines
  for select to authenticated using (
    public.can_read_gl(gl_account_id)
    and exists (
      select 1 from public.capital_projects p
       where p.id = capital_project_budget_lines.project_id
         and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
         and public.can_access_portfolio(p.portfolio_id)
         and public.can_view_association_row(p.association_id)));

create or replace function public.project_budget_vs_actual(p_project_id uuid)
returns table (line_id uuid, category text, gl_account_id uuid, gl_label text, budget_amount numeric, actual_amount numeric)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  p public.capital_projects;
begin
  select * into p from public.capital_projects where id = p_project_id;
  if not found
     or not (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
     or not public.can_access_portfolio(p.portfolio_id)
     or not public.can_view_association_row(p.association_id) then
    raise exception 'Project not found' using errcode = '42501';
  end if;

  return query
  with spend as (
    select b.gl_account_id as gl, sum(b.amount) as amount
      from public.capital_project_work_orders link
      join public.payable_bills b on b.work_order_id = link.work_order_id
     where link.project_id = p.id and b.archived_at is null
       and b.association_id = p.association_id
       and b.status::text in ('approved', 'paid')
     group by b.gl_account_id
  ),
  lines as (
    select l.*, (l.gl_account_id is null or public.can_read_gl(l.gl_account_id)) as readable
      from public.capital_project_budget_lines l where l.project_id = p.id
  ),
  spend_r as (
    select s.*, (s.gl is null or public.can_read_gl(s.gl)) as readable from spend s
  )
  select x.line_id, x.category, x.gl_account_id, x.gl_label, x.budget_amount, x.actual_amount
    from (
      -- Categories on accounts the caller can read.
      select l.id as line_id, l.category, l.gl_account_id, concat_ws(' ', g.number, g.name) as gl_label,
             l.budget_amount, coalesce(s.amount, 0)::numeric(14, 2) as actual_amount, l.sort_order as ord
        from lines l
        left join public.gl_accounts g on g.id = l.gl_account_id
        left join spend s on s.gl = l.gl_account_id
       where l.readable
      union all
      -- Readable spend on accounts with no category.
      select null::uuid, 'Other'::text, null::uuid, null::text, 0::numeric, sum(s.amount)::numeric(14, 2), 2147483646
        from spend_r s
       where s.readable and not exists (select 1 from lines l where l.gl_account_id is not distinct from s.gl)
      having sum(s.amount) is not null
      union all
      -- Everything on accounts the caller's role may not see, unnamed.
      select null::uuid, 'Restricted accounts'::text, null::uuid, null::text,
             coalesce((select sum(l.budget_amount) from lines l where not l.readable), 0)::numeric(14, 2),
             coalesce((select sum(s.amount) from spend_r s where not s.readable), 0)::numeric(14, 2),
             2147483647
       where exists (select 1 from lines l where not l.readable) or exists (select 1 from spend_r s where not s.readable)
    ) x
   order by x.ord, x.category;
end $function$;
