-- Vendor satisfaction ratings on completed work orders (AppFolio's vendor
-- survey). Staff, the owner of the unit, and the association's board can each
-- rate a completed job once (they can revise their own rating). Ratings feed
-- the vendor scorecard; vendors see scores and comments, never who rated.

create table if not exists public.work_order_ratings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  rated_by uuid not null references auth.users(id) on delete cascade,
  rater_role text not null check (rater_role in ('staff', 'owner', 'board')),
  score smallint not null check (score between 1 and 5),
  quality smallint check (quality between 1 and 5),
  timeliness smallint check (timeliness between 1 and 5),
  communication smallint check (communication between 1 and 5),
  would_hire_again boolean,
  comment text check (comment is null or length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_order_id, rated_by)
);
create index if not exists work_order_ratings_vendor_idx on public.work_order_ratings (vendor_id, created_at desc);

alter table public.work_order_ratings enable row level security;
drop policy if exists work_order_ratings_staff_read on public.work_order_ratings;
create policy work_order_ratings_staff_read on public.work_order_ratings for select to authenticated
  using (public.can_access_portfolio(portfolio_id));
drop policy if exists work_order_ratings_own_read on public.work_order_ratings;
create policy work_order_ratings_own_read on public.work_order_ratings for select to authenticated
  using (rated_by = auth.uid());
revoke all on public.work_order_ratings from anon;
grant select on public.work_order_ratings to authenticated;

-- Vendors read their own ratings without learning who left them.
create or replace function public.my_vendor_ratings(p_limit integer default 50)
returns table(work_order_id uuid, work_order_title text, rater_role text, score smallint, quality smallint,
              timeliness smallint, communication smallint, would_hire_again boolean, comment text, created_at timestamptz)
language sql stable security definer set search_path = pg_catalog, public as $$
  select r.work_order_id, wo.title, r.rater_role, r.score, r.quality, r.timeliness, r.communication,
         r.would_hire_again, r.comment, r.created_at
    from public.work_order_ratings r
    join public.work_orders wo on wo.id = r.work_order_id
   where public.current_vendor_id() is not null and r.vendor_id = public.current_vendor_id()
   order by r.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

create or replace function public.rate_work_order(
  p_work_order_id uuid, p_score integer, p_quality integer, p_timeliness integer,
  p_communication integer, p_would_hire_again boolean, p_comment text)
returns uuid
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare wo record; v_role text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to rate this job' using errcode = '42501'; end if;
  select w.id, w.status::text as status, w.vendor_id, w.unit_id, w.association_id,
         coalesce(w.portfolio_id, a.portfolio_id) as portfolio_id
    into wo
    from public.work_orders w left join public.associations a on a.id = w.association_id
   where w.id = p_work_order_id and w.archived_at is null;
  if not found then raise exception 'Work order not found' using errcode = 'P0002'; end if;

  if public.can_access_portfolio(wo.portfolio_id) then
    v_role := 'staff';
  elsif wo.association_id is not null and wo.association_id in (select public.current_board_association_ids()) then
    v_role := 'board';
  elsif public.current_owner_id() is not null and wo.unit_id is not null and exists (
          select 1 from public.occupancies o
           where o.unit_id = wo.unit_id and o.owner_id = public.current_owner_id()
             and o.status = 'current'::public.occupancy_status) then
    v_role := 'owner';
  else
    raise exception 'Work order not found' using errcode = 'P0002';
  end if;

  if wo.status not in ('done', 'completed', 'billed', 'closed') then
    raise exception 'You can rate the job once it is completed' using errcode = '55000';
  end if;
  if wo.vendor_id is null then
    raise exception 'This job had no vendor to rate' using errcode = '55000';
  end if;
  if p_score is null or p_score not between 1 and 5
     or (p_quality is not null and p_quality not between 1 and 5)
     or (p_timeliness is not null and p_timeliness not between 1 and 5)
     or (p_communication is not null and p_communication not between 1 and 5) then
    raise exception 'Ratings are from 1 to 5 stars' using errcode = '22023';
  end if;
  if length(coalesce(p_comment, '')) > 2000 then
    raise exception 'Comments are limited to 2,000 characters' using errcode = '22023';
  end if;

  insert into public.work_order_ratings as r
    (portfolio_id, work_order_id, vendor_id, rated_by, rater_role, score, quality, timeliness, communication, would_hire_again, comment)
  values (wo.portfolio_id, wo.id, wo.vendor_id, auth.uid(), v_role, p_score, p_quality, p_timeliness, p_communication,
          p_would_hire_again, nullif(btrim(p_comment), ''))
  on conflict (work_order_id, rated_by) do update set
    score = excluded.score, quality = excluded.quality, timeliness = excluded.timeliness,
    communication = excluded.communication, would_hire_again = excluded.would_hire_again,
    comment = excluded.comment, rater_role = excluded.rater_role, updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

alter function public.my_vendor_ratings(integer) owner to postgres;
alter function public.rate_work_order(uuid, integer, integer, integer, integer, boolean, text) owner to postgres;
revoke all on function public.my_vendor_ratings(integer) from public, anon;
revoke all on function public.rate_work_order(uuid, integer, integer, integer, integer, boolean, text) from public, anon;
grant execute on function public.my_vendor_ratings(integer) to authenticated, service_role;
grant execute on function public.rate_work_order(uuid, integer, integer, integer, integer, boolean, text) to authenticated, service_role;
