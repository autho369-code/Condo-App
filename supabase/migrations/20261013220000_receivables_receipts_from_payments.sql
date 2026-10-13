-- Speed at scale: the Receivables page counts receipts from payments.
--
-- receivables_page_totals counted and summed receipts through
-- receivable_payments_ledger, which also looks up every payment's owner,
-- occupancy, bank account, charges and applications; none of that is used
-- for a count and a sum. At 2,000 units (8,000 receipts, rolled back) it
-- took ~70-125 ms of the page's ~340 ms; read from payments it takes
-- ~7-9 ms with the same result. Same filters: not a credit, not reversed;
-- the association filter goes through the unit, building and association
-- the caller can see (the view's inner path); the owner filter by unit.
-- Patched in place: the old statement must match exactly once.

do $$
declare
  v_def text := pg_get_functiondef('public.receivables_page_totals(uuid, uuid[], uuid[])'::regprocedure);
  v_old text := $o$    from public.receivable_payments_ledger l
   where (l.method is null or l.method <> 'credit')
     and l.reversed_at is null
     and (p_association_id is null or l.association_id = p_association_id)
     and (p_owner_unit_ids is null or l.unit_id = any (p_owner_unit_ids));$o$;
  v_new text := $n$    from public.payments l
   where (l.method is null or l.method <> 'credit')
     and l.reversed_at is null
     and (p_association_id is null
          or exists (select 1
                       from public.units u
                       join public.buildings b on b.id = u.building_id
                       join public.associations a on a.id = b.association_id
                      where u.id = l.unit_id and a.id = p_association_id))
     and (p_owner_unit_ids is null or l.unit_id = any (p_owner_unit_ids));$n$;
begin
  if position('from public.payments l' in v_def) > 0 then
    return; -- already applied
  end if;
  if (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old) <> 1 then
    raise exception 'receivables_page_totals: receipts statement not found exactly once';
  end if;
  execute replace(v_def, v_old, v_new);
end
$$;
