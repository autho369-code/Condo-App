-- Codex on #383 (P1): a finance user could delete a removal credit directly
-- (payments_finance_all); its applications cascade, so the fee would read
-- outstanding again while the late_fee_removed audit record stays and no
-- audited path ran. Signed-in users can't delete a removal credit. The app
-- never deletes payments.
create or replace function public.payments_late_fee_removed_delete_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('authenticated', 'anon') and old.reference = 'Late fee removed' then
    raise exception 'A removed late fee''s credit can''t be deleted' using errcode = '42501';
  end if;
  return old;
end
$function$;

revoke all on function public.payments_late_fee_removed_delete_guard() from public, anon, authenticated;

create or replace trigger trg_payments_late_fee_removed_delete_guard
  before delete on public.payments
  for each row execute function public.payments_late_fee_removed_delete_guard();
