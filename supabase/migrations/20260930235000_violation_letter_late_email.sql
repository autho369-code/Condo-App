-- #86 review fix: a letter created while the owner had no email on file could
-- never be emailed later — emailed_to stayed null and the one-letter-per-step
-- index prevents a replacement. A letter whose step asked for email may now
-- move no_email_on_file -> pending (recording the address it goes to), and on
-- to queued once the email is really in the queue. Nothing else changes.
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
    if new.email_status = 'queued' then
      new.email_status := 'pending';
    end if;
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
  if new.email_status is distinct from old.email_status then
    if old.email_status = 'pending' and new.email_status = 'queued' then
      null;
    elsif old.email_status = 'no_email_on_file' and new.email_status = 'pending'
          and 'email' = any (old.delivery_methods)
          and nullif(btrim(coalesce(new.emailed_to, '')), '') is not null then
      new.emailed_to := btrim(new.emailed_to);  -- the address it now goes to
    else
      raise exception 'A letter''s email can only move from "pending" to "queued" (or get an address when none was on file)' using errcode = '22023';
    end if;
  end if;
  if not (old.email_status = 'no_email_on_file' and new.email_status = 'pending') then
    new.emailed_to := old.emailed_to;
  end if;
  new.id := old.id; new.violation_id := old.violation_id; new.association_id := old.association_id;
  new.owner_id := old.owner_id; new.step_order := old.step_order; new.step_name := old.step_name;
  new.subject := old.subject; new.body := old.body; new.pdf_path := old.pdf_path;
  new.delivery_methods := old.delivery_methods;
  new.created_by := old.created_by; new.created_at := old.created_at;
  if new.mail_status is not distinct from old.mail_status then
    new.mailed_at := old.mailed_at; new.mailed_by := old.mailed_by;
  end if;
  return new;
end $$;
