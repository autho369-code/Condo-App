-- sender_address and snapshot_claims on email_queue are written by email
-- delivery (service role) only. Signed-in users can write their company's
-- queue rows, so without this a direct client could set sender_address to
-- another company's address. Delivery also re-checks every stored sender
-- against the row's company. Additive only.

create or replace function public.email_queue_guard_worker_columns()
returns trigger
language plpgsql
set search_path to ''
as $function$
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
  end if;
  return new;
end;
$function$;

revoke execute on function public.email_queue_guard_worker_columns() from public, anon, authenticated;

create trigger email_queue_guard_worker_columns
  before insert or update on public.email_queue
  for each row execute function public.email_queue_guard_worker_columns();
