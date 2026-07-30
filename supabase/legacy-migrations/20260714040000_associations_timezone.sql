-- Times were rendered in server UTC (Vercel), showing a 5:30 PM Chicago board
-- meeting as 10:30 PM. Associations get an IANA timezone, default Chicago.
-- Applied via MCP 2026-07-14.
alter table public.associations
  add column if not exists timezone text not null default 'America/Chicago';
