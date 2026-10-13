-- Codex on #367: the hourly email limit (20261014220000) could be bypassed.
-- 1. It counted rows by created_at, which a signed-in caller supplies: rows
--    back-dated by the caller never counted. The insert guard now sets
--    created_at to the database time.
-- 2. Parallel sends each counted only committed rows and their own, so two
--    simultaneous 5,000-recipient sends were both admitted. The check now takes
--    a per-company lock first, so concurrent sends count one after another
--    (each count is a new statement, so it sees the sends committed before it).

-- 1. ---------------------------------------------------------------------------
do $do$
declare
  v_def text := replace(pg_get_functiondef('public.email_queue_guard_user_insert()'::regprocedure), E'\r\n', E'\n');
  v_old text := E'  new.sent_by := auth.uid();\n';
  v_new text := E'  new.sent_by := auth.uid();\n'
             || E'  -- The hourly limit counts by created_at: the database sets it.\n'
             || E'  new.created_at := now();\n';
begin
  if position('new.created_at := now();' in v_def) > 0 then
    raise notice 'email_queue_guard_user_insert already patched';
    return;
  end if;
  if array_length(string_to_array(v_def, v_old), 1) <> 2 then
    raise exception 'email_queue_guard_user_insert: expected text not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$do$;

-- 2. ---------------------------------------------------------------------------
create or replace function public.email_queue_user_rate_limit()
returns trigger
language plpgsql
-- Invoker on purpose: it limits what signed-in users queue.
set search_path = pg_catalog, public
as $function$
declare
  r record;
  v_over text;
begin
  if current_user not in ('authenticated', 'anon') then
    return null;
  end if;
  -- One company's sends are checked one at a time (locks taken in a fixed
  -- order, so two multi-company inserts can't deadlock). This function must
  -- stay VOLATILE and the count must be its own statement after the lock: under
  -- READ COMMITTED it then sees every send committed while it waited.
  for r in select distinct portfolio_id from new_rows where portfolio_id is not null order by portfolio_id loop
    perform pg_advisory_xact_lock(hashtextextended('email_queue_rate:' || r.portfolio_id::text, 0));
  end loop;
  select coalesce(p.company_name, n.portfolio_id::text) into v_over
    from (select distinct portfolio_id from new_rows where portfolio_id is not null) n
    left join public.portfolios p on p.id = n.portfolio_id
   where public.email_queue_company_recent_count(n.portfolio_id) > 5000
   limit 1;
  if v_over is not null then
    raise exception 'More than 5,000 emails were queued for % in the last hour; try again later', v_over using errcode = '54000';
  end if;
  return null;
end
$function$;

revoke all on function public.email_queue_user_rate_limit() from public, anon, authenticated;
