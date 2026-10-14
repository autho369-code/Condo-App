-- Codex on #383 (P2): the "removed" label reads payments.reversed_at, which
-- finance staff could set or clear directly on a removal credit, flipping
-- the label without reverse_homeowner_payment (security definer) or its
-- reversal and audit records. Signed-in users now can't change reversed_at
-- on a removal credit either. The app never writes reversed_at directly.
create or replace function public.payments_late_fee_removed_marker()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if current_user in ('authenticated', 'anon') then
    if (tg_op = 'INSERT' and new.reference = 'Late fee removed')
       or (tg_op = 'UPDATE' and new.reference is distinct from old.reference
           and (new.reference = 'Late fee removed' or old.reference = 'Late fee removed'))
       or (tg_op = 'UPDATE' and old.reference = 'Late fee removed'
           and (new.method is distinct from old.method
                or new.charge_id is distinct from old.charge_id
                or new.reversed_at is distinct from old.reversed_at)) then
      raise exception 'The reference "Late fee removed" is reserved. Remove late fees from the unit page' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.payments_late_fee_removed_marker() from public, anon, authenticated;

create or replace trigger trg_payments_late_fee_removed_marker
  before insert or update of reference, method, charge_id, reversed_at on public.payments
  for each row execute function public.payments_late_fee_removed_marker();
