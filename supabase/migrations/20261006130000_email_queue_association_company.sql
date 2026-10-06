-- A queue row written by a signed-in user must belong to its association's
-- company. email_queue_staff_all admits a row through its association alone,
-- so without this a user could pair an association they can reach with
-- another company's portfolio_id. When portfolio_id is left empty it is filled
-- from the association. (Email delivery also takes the company from the
-- association.) Additive only.

create or replace function public.email_queue_guard_worker_columns()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  v_company uuid;
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.sender_address is not null or coalesce(new.snapshot_claims, 0) <> 0 then
        raise exception 'The sending address is set by email delivery only.' using errcode = '42501';
      end if;
    elsif new.sender_address is distinct from old.sender_address
       or new.snapshot_claims is distinct from old.snapshot_claims then
      raise exception 'The sending address is set by email delivery only.' using errcode = '42501';
    end if;

    if new.association_id is not null then
      select a.portfolio_id into v_company from public.associations a where a.id = new.association_id;
      if new.portfolio_id is null then
        new.portfolio_id := v_company;
      elsif new.portfolio_id is distinct from v_company then
        raise exception 'The email''s company does not match its association.' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$function$;
