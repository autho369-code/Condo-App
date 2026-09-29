-- calendar_event_reminders / automation_tasks referenced calendar events and
-- violations by id with no foreign keys, so the Automation Center's embedded
-- selects (calendar_events(...)) failed with PGRST200 and the page lists were
-- empty. No orphaned rows existed when this was added.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'calendar_event_reminders_calendar_event_id_fkey') then
    alter table public.calendar_event_reminders
      add constraint calendar_event_reminders_calendar_event_id_fkey
      foreign key (calendar_event_id) references public.calendar_events(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'automation_tasks_calendar_event_id_fkey') then
    alter table public.automation_tasks
      add constraint automation_tasks_calendar_event_id_fkey
      foreign key (calendar_event_id) references public.calendar_events(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'automation_tasks_violation_id_fkey') then
    alter table public.automation_tasks
      add constraint automation_tasks_violation_id_fkey
      foreign key (violation_id) references public.violations(id) on delete set null;
  end if;
end $$;

create index if not exists calendar_event_reminders_calendar_event_id_idx on public.calendar_event_reminders (calendar_event_id);
create index if not exists automation_tasks_calendar_event_id_idx on public.automation_tasks (calendar_event_id);
create index if not exists automation_tasks_violation_id_idx on public.automation_tasks (violation_id);

-- PostgREST caches relationships; reload so the new embeds work immediately.
notify pgrst, 'reload schema';
