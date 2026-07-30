-- AIOS Dashboard Initial Schema (idempotent — verifies tables exist with the dashboard's expected shape)
-- Tables already exist in this project from prior migrations; this records the dashboard's
-- 0001_initial_schema as applied and confirms compatibility.

-- 1. PROFILES
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  avatar_url  text,
  role        text default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. ACTIVITY LOG
create table if not exists public.activity (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  action      text not null,
  agent       text,
  file        text,
  details     text,
  created_at  timestamptz default now()
);
create index if not exists activity_user_created_idx on public.activity(user_id, created_at desc);
create index if not exists activity_action_idx on public.activity(action);
create index if not exists activity_agent_idx on public.activity(agent);

-- 3. AGENTS (filesystem sync)
create table if not exists public.agents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  slug        text not null,
  name        text not null,
  summary     text,
  files       jsonb default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, slug)
);
create index if not exists agents_user_idx on public.agents(user_id);

-- 4. WORKFLOWS
create table if not exists public.workflows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  description text,
  steps       jsonb default '[]'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists workflows_user_idx on public.workflows(user_id);

-- 5. PUBLIC SHARES
create table if not exists public.shares (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  resource_type text not null check (resource_type in ('agent', 'workflow', 'query', 'file', 'note')),
  resource_id   text not null,
  snapshot      jsonb not null,
  slug          text unique not null default substring(md5(random()::text) from 1 for 10),
  title         text,
  description   text,
  view_count    int default 0,
  expires_at    timestamptz,
  created_at    timestamptz default now()
);
create index if not exists shares_slug_idx on public.shares(slug);
create index if not exists shares_user_idx on public.shares(user_id);

-- 6. UPDATED_AT TRIGGER
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $touch$
begin
  new.updated_at = now();
  return new;
end;
$touch$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists agents_touch on public.agents;
create trigger agents_touch before update on public.agents
  for each row execute function public.touch_updated_at();

drop trigger if exists workflows_touch on public.workflows;
create trigger workflows_touch before update on public.workflows
  for each row execute function public.touch_updated_at();;
