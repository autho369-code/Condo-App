-- Project cost categories review fixes:
-- 1. project_budget_vs_actual computes actuals as definer after checking the caller can see the
--    project (staff/company admin/operator in scope). Non-finance staff no longer get $0 actuals
--    because payable_bills RLS hides bills from them.
-- 2. Budget lines of archived projects cannot be deleted.
-- 3. Board read policy dropped: there is no board project-budget screen, so it granted access
--    nothing used.

drop policy if exists capital_project_budget_lines_board_read on public.capital_project_budget_lines;

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
  )
  select x.line_id, x.category, x.gl_account_id, x.gl_label, x.budget_amount, x.actual_amount
    from (
      select l.id as line_id, l.category, l.gl_account_id, concat_ws(' ', g.number, g.name) as gl_label,
             l.budget_amount, coalesce(s.amount, 0)::numeric(14, 2) as actual_amount, l.sort_order as ord
        from public.capital_project_budget_lines l
        left join public.gl_accounts g on g.id = l.gl_account_id
        left join spend s on s.gl = l.gl_account_id
       where l.project_id = p.id
      union all
      select null::uuid, 'Other'::text, null::uuid, null::text, 0::numeric, sum(s.amount)::numeric(14, 2), 2147483647
        from spend s
       where not exists (select 1 from public.capital_project_budget_lines l
                          where l.project_id = p.id and l.gl_account_id is not distinct from s.gl)
      having sum(s.amount) is not null
    ) x
   order by x.ord, x.category;
end $function$;

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
  if p.archived_at is not null then
    raise exception 'This project is archived; its budget can''t be changed' using errcode = '22023';
  end if;
  delete from public.capital_project_budget_lines where id = p_id;
end $function$;
