-- platform_requests.internal_notes is the platform operator's private note on
-- a company's support request, but platform_requests_read lets the company
-- admin read the whole row through the API. Move it to an operator-only side
-- table (same pattern as the *_private tables of 20261004200000): a write to
-- platform_requests.internal_notes is moved there by a trigger and the parent
-- column stays empty. Production had 0 notes on 2026-10-05.

create table if not exists public.platform_request_private (
  request_id uuid primary key references public.platform_requests(id) on delete cascade deferrable initially deferred,
  internal_notes text,
  updated_at timestamptz not null default now()
);

alter table public.platform_request_private enable row level security;
revoke all on public.platform_request_private from anon;
grant select, insert, update, delete on public.platform_request_private to authenticated;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'platform_request_private' and policyname = 'platform_request_private_operator') then
    create policy platform_request_private_operator on public.platform_request_private
      for all to authenticated
      using (public.is_platform_operator())
      with check (public.is_platform_operator());
  end if;
end $$;

create or replace function public.move_platform_request_private_fields()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if auth.uid() is not null and not public.is_platform_operator() then
    -- Only platform operators write their own notes.
    new.internal_notes := null;
    return new;
  end if;
  if new.internal_notes is not null then
    insert into public.platform_request_private (request_id, internal_notes, updated_at)
    values (new.id, nullif(btrim(new.internal_notes), ''), now())
    on conflict (request_id) do update set internal_notes = excluded.internal_notes, updated_at = now();
    new.internal_notes := null;
  end if;
  return new;
end $$;

revoke all on function public.move_platform_request_private_fields() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'platform_requests_move_private_fields' and tgrelid = 'public.platform_requests'::regclass) then
    create trigger platform_requests_move_private_fields before insert or update of internal_notes on public.platform_requests
      for each row execute function public.move_platform_request_private_fields();
  end if;
end $$;

insert into public.platform_request_private (request_id, internal_notes)
select id, nullif(btrim(internal_notes), '') from public.platform_requests where internal_notes is not null
on conflict (request_id) do nothing;
update public.platform_requests set internal_notes = null where internal_notes is not null;
