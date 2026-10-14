-- Clearer message when staff type the reserved reference "Late fee removed"
-- on a receipt or credit (white-label review on 20261015130000). Same rule.
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
       or (tg_op = 'UPDATE' and old.reference = 'Late fee removed' and new.method is distinct from old.method) then
      raise exception 'The reference "Late fee removed" is reserved. Remove late fees from the unit page' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.payments_late_fee_removed_marker() from public, anon, authenticated;
