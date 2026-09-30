-- Homeowner email history with delivery / open tracking.
-- * email_queue rows are linked to the homeowner they were sent to (owner_id),
--   set automatically on insert by matching the recipient address against the
--   owners in the same company, and backfilled for existing rows.
-- * Resend delivery webhooks (delivered / opened / clicked / bounced /
--   complained) land in email_events and roll up onto the email row.
--   The webhook is verified in /api/webhooks/resend; only service_role can
--   record events.

alter table public.email_queue
  add column if not exists owner_id uuid references public.owners(id) on delete set null,
  add column if not exists delivered_at timestamptz,
  add column if not exists first_opened_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists open_count integer not null default 0,
  add column if not exists clicked_at timestamptz,
  add column if not exists bounced_at timestamptz,
  add column if not exists complained_at timestamptz,
  add column if not exists delivery_status text;
create index if not exists email_queue_owner_idx on public.email_queue (owner_id, created_at desc) where owner_id is not null;
create index if not exists email_queue_provider_message_idx on public.email_queue (provider_message_id) where provider_message_id is not null;

create or replace function public.email_owner_for_address(p_portfolio_id uuid, p_email text)
returns uuid language sql stable security definer set search_path = pg_catalog, public as $$
  -- Only link when exactly one homeowner in the company uses the address.
  select case when count(*) = 1 then min(o.id::text)::uuid end
    from public.owners o
   where p_portfolio_id is not null and o.portfolio_id = p_portfolio_id and o.archived_at is null
     and (lower(o.email) = lower(btrim(p_email))
          or (jsonb_typeof(o.emails) = 'array' and exists (
                select 1 from jsonb_array_elements_text(o.emails) e where lower(e) = lower(btrim(p_email)))));
$$;

create or replace function public.email_queue_link_owner()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if new.owner_id is null and new.to_email is not null then
    new.owner_id := public.email_owner_for_address(
      coalesce(new.portfolio_id, (select a.portfolio_id from public.associations a where a.id = new.association_id)),
      new.to_email);
  end if;
  return new;
end $$;
drop trigger if exists trg_email_queue_link_owner on public.email_queue;
create trigger trg_email_queue_link_owner before insert on public.email_queue
  for each row execute function public.email_queue_link_owner();

update public.email_queue q
   set owner_id = public.email_owner_for_address(
         coalesce(q.portfolio_id, (select a.portfolio_id from public.associations a where a.id = q.association_id)), q.to_email)
 where q.owner_id is null;

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.email_queue(id) on delete cascade,
  provider_event_id text unique,
  event_type text not null check (event_type in ('sent', 'delivered', 'delivery_delayed', 'opened', 'clicked', 'bounced', 'complained', 'failed')),
  occurred_at timestamptz not null default now(),
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists email_events_email_idx on public.email_events (email_id, occurred_at desc);
alter table public.email_events enable row level security;
drop policy if exists email_events_staff_read on public.email_events;
create policy email_events_staff_read on public.email_events for select to authenticated
  using (exists (select 1 from public.email_queue q where q.id = email_id));  -- inherits email_queue RLS
revoke all on public.email_events from anon;
revoke insert, update, delete on public.email_events from authenticated;
grant select on public.email_events to authenticated;

create or replace function public.record_email_event(
  p_provider_message_id text, p_event_type text, p_occurred_at timestamptz,
  p_provider_event_id text default null, p_detail text default null)
returns boolean language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_email uuid; v_at timestamptz := coalesce(p_occurred_at, now()); v_inserted int;
begin
  select id into v_email from public.email_queue where provider_message_id = p_provider_message_id limit 1;
  if v_email is null then return false; end if;

  insert into public.email_events (email_id, provider_event_id, event_type, occurred_at, detail)
  values (v_email, nullif(p_provider_event_id, ''), p_event_type, v_at, left(p_detail, 500))
  on conflict (provider_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return true; end if;  -- webhook retry: already counted

  update public.email_queue set
    delivered_at = case when p_event_type = 'delivered' then coalesce(delivered_at, v_at) else delivered_at end,
    first_opened_at = case when p_event_type = 'opened' then least(coalesce(first_opened_at, v_at), v_at) else first_opened_at end,
    last_opened_at = case when p_event_type = 'opened' then greatest(coalesce(last_opened_at, v_at), v_at) else last_opened_at end,
    open_count = open_count + case when p_event_type = 'opened' then 1 else 0 end,
    clicked_at = case when p_event_type = 'clicked' then coalesce(clicked_at, v_at) else clicked_at end,
    bounced_at = case when p_event_type = 'bounced' then coalesce(bounced_at, v_at) else bounced_at end,
    complained_at = case when p_event_type = 'complained' then coalesce(complained_at, v_at) else complained_at end,
    delivery_status = case
      when p_event_type in ('bounced', 'complained', 'failed') then p_event_type
      when delivery_status in ('bounced', 'complained', 'failed') then delivery_status
      when p_event_type in ('opened', 'clicked') then 'opened'
      when p_event_type = 'delivered' and coalesce(delivery_status, '') <> 'opened' then 'delivered'
      when p_event_type = 'delivery_delayed' and delivery_status is null then 'delayed'
      else delivery_status end
  where id = v_email;
  return true;
end $$;

do $$
begin
  alter function public.record_email_event(text, text, timestamptz, text, text) owner to postgres;
  revoke all on function public.record_email_event(text, text, timestamptz, text, text) from public, anon, authenticated;
  grant execute on function public.record_email_event(text, text, timestamptz, text, text) to service_role;
  alter function public.email_owner_for_address(uuid, text) owner to postgres;
  revoke all on function public.email_owner_for_address(uuid, text) from public, anon, authenticated;
  alter function public.email_queue_link_owner() owner to postgres;
  revoke all on function public.email_queue_link_owner() from public, anon, authenticated;
end $$;
