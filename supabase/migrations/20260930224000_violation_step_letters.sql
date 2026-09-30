-- Violation step letters. Each follow-up step already stores a letter template
-- and delivery methods (email / portal / mail), but advancing a violation only
-- logged the step — nothing was sent. Every advance now produces a letter:
-- filled from the step's template (or a standard letter), saved as a PDF, and
-- delivered by the step's methods. This table is the record of what was sent,
-- and the queue of letters that still need to be printed and mailed.

create table if not exists public.violation_letters (
  id               uuid primary key default gen_random_uuid(),
  violation_id     uuid not null references public.violations(id) on delete cascade,
  association_id   uuid not null references public.associations(id) on delete cascade,
  owner_id         uuid references public.owners(id) on delete set null,
  step_order       integer not null,
  step_name        text not null,
  subject          text not null check (length(subject) between 1 and 300),
  body             text not null check (length(body) between 1 and 50000),
  pdf_path         text not null,
  delivery_methods text[] not null default '{}',
  emailed_to       text,
  email_status     text not null default 'not_requested'
                     check (email_status in ('not_requested', 'queued', 'no_email_on_file')),
  mail_status      text not null default 'not_requested'
                     check (mail_status in ('not_requested', 'to_mail', 'mailed')),
  mailed_at        timestamptz,
  mailed_by        uuid,
  created_by       uuid,
  created_at       timestamptz not null default now()
);
create index if not exists violation_letters_violation_idx on public.violation_letters (violation_id, created_at desc);
create index if not exists violation_letters_to_mail_idx on public.violation_letters (association_id, created_at) where mail_status = 'to_mail';
create index if not exists violation_letters_owner_idx on public.violation_letters (owner_id) where owner_id is not null;

-- The violation decides the association and owner; callers can't point a
-- letter at someone else. Only mail status may change afterwards.
create or replace function public.violation_letters_bind()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v public.violations;
begin
  if tg_op = 'INSERT' then
    select * into v from public.violations where id = new.violation_id;
    if v.id is null then
      raise exception 'Violation not found' using errcode = '23503';
    end if;
    new.association_id := v.association_id;
    new.owner_id := v.owner_id;
    new.created_by := auth.uid();
    new.created_at := now();
    if new.pdf_path not like 'violations/' || v.id::text || '/letters/%' then
      raise exception 'Letter file must be stored under the violation' using errcode = '22023';
    end if;
    return new;
  end if;
  if new.mail_status is distinct from old.mail_status then
    if not (old.mail_status = 'to_mail' and new.mail_status = 'mailed') then
      raise exception 'A letter can only move from "to mail" to "mailed"' using errcode = '22023';
    end if;
    new.mailed_at := now();
    new.mailed_by := auth.uid();
  end if;
  -- Everything else is the record of what was sent and never changes.
  new.id := old.id; new.violation_id := old.violation_id; new.association_id := old.association_id;
  new.owner_id := old.owner_id; new.step_order := old.step_order; new.step_name := old.step_name;
  new.subject := old.subject; new.body := old.body; new.pdf_path := old.pdf_path;
  new.delivery_methods := old.delivery_methods; new.emailed_to := old.emailed_to; new.email_status := old.email_status;
  new.created_by := old.created_by; new.created_at := old.created_at;
  if new.mail_status is not distinct from old.mail_status then
    new.mailed_at := old.mailed_at; new.mailed_by := old.mailed_by;
  end if;
  return new;
end $$;
drop trigger if exists trg_violation_letters_000_bind on public.violation_letters;
create trigger trg_violation_letters_000_bind before insert or update on public.violation_letters
  for each row execute function public.violation_letters_bind();

alter table public.violation_letters enable row level security;
revoke all on public.violation_letters from anon;
revoke delete on public.violation_letters from authenticated;
grant select, insert, update on public.violation_letters to authenticated;

drop policy if exists violation_letters_staff_read on public.violation_letters;
create policy violation_letters_staff_read on public.violation_letters for select to authenticated
  using (public.can_manage_violations(association_id));
drop policy if exists violation_letters_owner_read on public.violation_letters;
create policy violation_letters_owner_read on public.violation_letters for select to authenticated
  using (owner_id is not null and owner_id = public.current_owner_id() and 'portal' = any (delivery_methods));
drop policy if exists violation_letters_staff_insert on public.violation_letters;
create policy violation_letters_staff_insert on public.violation_letters for insert to authenticated
  with check (public.can_manage_violations(association_id));
drop policy if exists violation_letters_staff_update on public.violation_letters;
create policy violation_letters_staff_update on public.violation_letters for update to authenticated
  using (public.can_manage_violations(association_id))
  with check (public.can_manage_violations(association_id));
drop policy if exists mgr_assoc_scope on public.violation_letters;
create policy mgr_assoc_scope on public.violation_letters as restrictive for all to authenticated
  using (public.can_view_association_row(association_id));
