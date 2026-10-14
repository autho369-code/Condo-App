-- Codex on #383 (P1): a finance user could delete a removal credit's
-- payment_applications row directly (payment_apps_finance), reopening the
-- fee while its credit, journal entry and late_fee_removed audit record
-- stay. unapply_payment is not callable by signed-in users (revoked in
-- 20261003080000), and database functions run as their owner, so signed-in
-- deletes of a removal credit's application are refused too.
create or replace function public.payment_applications_removal_credit_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('authenticated', 'anon') then
    if (tg_op in ('INSERT', 'UPDATE') and public.is_late_fee_removal_credit(new.payment_id))
       or (tg_op in ('UPDATE', 'DELETE') and public.is_late_fee_removal_credit(old.payment_id)) then
      raise exception 'A removed late fee''s credit can''t be applied or unapplied by hand. Remove late fees from the unit page' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;

revoke all on function public.payment_applications_removal_credit_guard() from public, anon, authenticated;

create or replace trigger trg_payment_applications_removal_credit_guard
  before insert or update or delete on public.payment_applications
  for each row execute function public.payment_applications_removal_credit_guard();
