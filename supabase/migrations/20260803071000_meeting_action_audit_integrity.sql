-- Preserve the audit identity and completion evidence on governed meeting
-- follow-up actions, even when a caller bypasses the application form and
-- writes through the authenticated Data API directly.

create or replace function public.guard_meeting_action_item_audit()
returns trigger
language plpgsql
set search_path = 'pg_catalog', 'public'
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.meeting_id := old.meeting_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;

  if new.status = 'completed' then
    if tg_op = 'INSERT' or old.status is distinct from 'completed' then
      new.completed_at := now();
      new.completed_by := coalesce(auth.uid(), new.completed_by);
    else
      new.completed_at := old.completed_at;
      new.completed_by := old.completed_by;
    end if;
  else
    new.completed_at := null;
    new.completed_by := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_meeting_action_item_audit on public.meeting_action_items;
create trigger trg_meeting_action_item_audit
before insert or update on public.meeting_action_items
for each row execute function public.guard_meeting_action_item_audit();

revoke all on function public.guard_meeting_action_item_audit() from public, anon, authenticated;
grant execute on function public.guard_meeting_action_item_audit() to service_role;
