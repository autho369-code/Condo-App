-- Project cost by category: PO balances follow the bill's GL account
-- (Codex on #397, 2026-10-14).
-- project_cost_by_category used up a PO's lines in sort order by its total
-- billed amount, ignoring each bill's GL account: with $50 lines on A and B,
-- a $50 bill coded to B used up A, then the bill also counted on B (A $0,
-- B $100). Now a bill first uses up the lines of its own account; only the
-- amount billed beyond them uses up the remaining lines in order. Per-PO
-- totals are unchanged (lines - billed), so capital_project_cost_totals
-- still agrees.
-- Body is 20261016220000's (live as 20261014181833) with only the PO CTEs changed.

create or replace function public.project_cost_by_category(p_project_id uuid)
returns table(line_id uuid, category text, gl_account_id uuid, gl_label text, budget_amount numeric, committed_amount numeric, spent_amount numeric)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  p public.capital_projects;
  v_fin boolean;
begin
  select * into p from public.capital_projects where id = p_project_id;
  if not found
     or not (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
     or not public.can_access_portfolio(p.portfolio_id)
     or not public.can_view_association_row(p.association_id) then
    raise exception 'Project not found' using errcode = '42501';
  end if;
  -- Purchase orders are finance-only: their open amounts count only for
  -- finance staff (same check as the purchase_orders policy); other staff
  -- see bill-only figures.
  v_fin := coalesce(public.is_platform_operator(), false)
           or coalesce(public.my_finance_portfolio() = p.portfolio_id, false);

  return query
  with links as (
    select distinct link.work_order_id from public.capital_project_work_orders link where link.project_id = p.id
  ),
  bill_costs as (
    select b.gl_account_id as gl,
           coalesce(sum(b.amount) filter (where b.status::text in ('draft', 'pending_approval', 'approved')), 0) as committed,
           coalesce(sum(b.amount) filter (where b.status::text = 'paid'), 0) as spent
      from links lk
      join public.payable_bills b on b.work_order_id = lk.work_order_id
     where b.archived_at is null
       and b.association_id = p.association_id
     group by b.gl_account_id
  ),
  -- po_cost_by_billed_gl: a bill on the PO first uses up the PO lines of its
  -- own GL account; only what is billed beyond them (another account, or
  -- more than that account's lines) uses up the PO's remaining lines in
  -- order. So a $50 bill coded to B leaves A's $50 open, not B's.
  po_gl as (
    select po.id as po_id, l.gl_account_id as gl, sum(l.line_total) as lines, min(l.sort_order) as ord
      from links lk
      join public.purchase_orders po on po.work_order_id = lk.work_order_id
      join public.purchase_order_line_items l on l.purchase_order_id = po.id
     where v_fin
       and po.archived_at is null
       and po.association_id = p.association_id
       and po.approval_status = 'approved'
       and po.status::text <> 'cancelled'
     group by po.id, l.gl_account_id
  ),
  po_bill_gl as (
    select b.purchase_order_id as po_id, b.gl_account_id as gl, sum(b.amount) as billed
      from public.payable_bills b
     where b.purchase_order_id in (select g.po_id from po_gl g)
       and b.status::text <> 'void'
       and b.archived_at is null
     group by b.purchase_order_id, b.gl_account_id
  ),
  po_extra as (
    select pb.po_id, sum(greatest(pb.billed - coalesce(g.lines, 0), 0)) as extra
      from po_bill_gl pb
      left join po_gl g on g.po_id = pb.po_id and g.gl is not distinct from pb.gl
     group by pb.po_id
  ),
  po_open as (
    select g.po_id, g.gl,
           greatest(g.lines - coalesce(pb.billed, 0), 0) as open_gl,
           sum(greatest(g.lines - coalesce(pb.billed, 0), 0))
             over (partition by g.po_id order by g.ord, g.gl::text) as running
      from po_gl g
      left join po_bill_gl pb on pb.po_id = g.po_id and pb.gl is not distinct from g.gl
  ),
  po_costs as (
    select o.gl, sum(greatest(least(o.open_gl, o.running - coalesce(e.extra, 0)), 0)) as committed, 0::numeric as spent
      from po_open o
      left join po_extra e on e.po_id = o.po_id
     group by o.gl
  ),
  spend as (
    select c.gl, sum(c.committed) as committed, sum(c.spent) as spent
      from (select * from bill_costs union all select * from po_costs) c
     group by c.gl
     having sum(c.committed) <> 0 or sum(c.spent) <> 0
  ),
  lines as (
    select l.*, (l.gl_account_id is null or public.can_read_gl(l.gl_account_id)) as readable
      from public.capital_project_budget_lines l where l.project_id = p.id
  ),
  spend_r as (
    select s.*, (s.gl is null or public.can_read_gl(s.gl)) as readable from spend s
  )
  select x.line_id, x.category, x.gl_account_id, x.gl_label, x.budget_amount, x.committed_amount, x.spent_amount
    from (
      select l.id as line_id, l.category, l.gl_account_id, concat_ws(' ', g.number, g.name) as gl_label,
             l.budget_amount,
             coalesce(s.committed, 0)::numeric(14, 2) as committed_amount,
             coalesce(s.spent, 0)::numeric(14, 2) as spent_amount,
             l.sort_order as ord
        from lines l
        left join public.gl_accounts g on g.id = l.gl_account_id
        left join spend s on s.gl = l.gl_account_id
       where l.readable
      union all
      select null::uuid, 'Other'::text, null::uuid, null::text, 0::numeric,
             sum(s.committed)::numeric(14, 2), sum(s.spent)::numeric(14, 2), 2147483646
        from spend_r s
       where s.readable and not exists (select 1 from lines l where l.gl_account_id is not distinct from s.gl)
      having count(*) > 0
      union all
      select null::uuid, 'Restricted accounts'::text, null::uuid, null::text,
             coalesce((select sum(l.budget_amount) from lines l where not l.readable), 0)::numeric(14, 2),
             coalesce((select sum(s.committed) from spend_r s where not s.readable), 0)::numeric(14, 2),
             coalesce((select sum(s.spent) from spend_r s where not s.readable), 0)::numeric(14, 2),
             2147483647
       where exists (select 1 from lines l where not l.readable) or exists (select 1 from spend_r s where not s.readable)
    ) x
   order by x.ord, x.category;
end $function$;

revoke all on function public.project_cost_by_category(uuid) from public, anon;
grant execute on function public.project_cost_by_category(uuid) to authenticated;
