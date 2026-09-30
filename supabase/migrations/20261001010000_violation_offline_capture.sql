-- Offline violation capture: the field form queues captures on the device and
-- syncs them when a connection returns. A sync can be retried after a lost
-- response, so each capture carries the device's client mutation id and the
-- same capture can only ever create one violation per staff member.
alter table public.violations add column if not exists client_mutation_id text;

create unique index if not exists violations_created_by_client_mutation_key
  on public.violations (created_by, client_mutation_id)
  where client_mutation_id is not null;
