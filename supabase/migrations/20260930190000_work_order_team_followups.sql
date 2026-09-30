-- Follow-ups to the maintenance team scoreboard (#75 review):
-- 1. work_order_staff(work_order) lists the team members who can actually
--    open that work order: association-scoped managers only for their own
--    associations (same rule as can_view_association_row). The assignee and
--    labor pickers use it, and the server actions validate against it.
-- 2. work_orders.completed_by_assignee_id records who was assigned when the
--    job was finished, so reassigning (or clearing) the assignee afterwards
--    doesn't move completion credit on the scoreboard. It is stamped when a
--    job finishes from an active/cancelled status, kept across finished ->
--    finished moves, and cleared when the job is reopened.
create or replace function public.work_order_staff(p_work_order uuid)
returns table (id uuid, name text) language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare w record;
begin
  select wo.id, coalesce(wo.portfolio_id, a.portfolio_id) as portfolio_id, wo.association_id into w
    from public.work_orders wo left join public.associations a on a.id = wo.association_id
   where wo.id = p_work_order;
  if w.id is null or not (public.is_platform_operator() or public.is_any_staff() or public.is_company_admin())
     or not public.can_access_portfolio(w.portfolio_id) or not public.can_manage_association(w.association_id) then
    return;
  end if;
  return query
    select p.id, coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.display_name), ''), p.email)
      from public.profiles p
     where p.portfolio_id = w.portfolio_id and p.disabled_at is null and p.hoa_role in ('manager', 'company_admin')
       and (not exists (select 1 from public.association_managers am where am.user_id = p.id)
            or exists (select 1 from public.association_managers am where am.user_id = p.id and am.association_id = w.association_id))
     order by 2;
end $$;
revoke all on function public.work_order_staff(uuid) from public, anon;
grant execute on function public.work_order_staff(uuid) to authenticated;

alter table public.work_orders add column if not exists completed_by_assignee_id uuid;

create or replace function public.work_order_stamp_completion()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare finishing text[] := array['done', 'completed', 'billed', 'closed'];
begin
  if new.status::text = any (finishing) then
    if tg_op = 'UPDATE' and old.status::text = any (finishing) then
      if new.status is distinct from old.status then
        -- Finished -> finished: the job was completed when it was first finished.
        new.completed_date := coalesce(old.completed_date, new.completed_date, current_date);
      end if;
      new.completed_by_assignee_id := coalesce(old.completed_by_assignee_id, new.completed_by_assignee_id);
    else
      if new.completed_date is null then new.completed_date := current_date; end if;
      new.completed_by_assignee_id := new.assignee_id;
    end if;
  elsif new.status = 'cancelled' then
    if tg_op = 'INSERT' or old.status is distinct from 'cancelled' then new.completed_date := null; end if;
    new.completed_by_assignee_id := null;
  elsif tg_op = 'UPDATE' and (old.status::text = any (finishing) or old.status = 'cancelled') then
    new.completed_date := null;
    new.completed_by_assignee_id := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_work_order_stamp_completion on public.work_orders;
create trigger trg_work_order_stamp_completion before insert or update of status, completed_date, assignee_id, completed_by_assignee_id on public.work_orders
  for each row execute function public.work_order_stamp_completion();

update public.work_orders
   set completed_by_assignee_id = assignee_id
 where status in ('done', 'completed', 'billed', 'closed') and completed_by_assignee_id is null and assignee_id is not null;
