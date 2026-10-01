-- #107 review fixes for the Receivables tasks.
--  1. charge_late_fees_now only sends charges already past the grace period to
--     the fee engine (the nightly job filters the same way), so large
--     associations don't make thousands of no-op calls.
--  2. receivables_task_associations(): the associations the caller can act on
--     (finance + association scope), with the full unapplied total and the
--     late-fee policy, so the page shows correct totals and only usable choices.

do $$
declare def text;
begin
  def := pg_get_functiondef('public.charge_late_fees_now(uuid)'::regprocedure);
  if def !~ 'where b\.association_id = p_association_id and ch\.charge_type = ''assessment''' then
    raise exception 'receivables_tasks_review_fixes: charge_late_fees_now drifted';
  end if;
  def := replace(def, 'where b.association_id = p_association_id and ch.charge_type = ''assessment''',
    'where b.association_id = p_association_id and ch.charge_type = ''assessment''' || chr(10) ||
    '       and ch.due_date + coalesce((select a.late_fee_grace_days from public.associations a where a.id = p_association_id), 10) < current_date');
  execute def;
end $$;

create or replace function public.receivables_task_associations()
returns table (association_id uuid, name text, unapplied numeric, late_fee_enabled boolean,
               late_fee_amount numeric, late_fee_is_percent boolean, late_fee_grace_days integer)
language sql stable security definer set search_path = pg_catalog, public as $$
  select a.id, a.name,
         coalesce((select sum(v.unapplied_amount) from public.v_unapplied_credits v
                     join public.units u on u.id = v.unit_id join public.buildings b on b.id = u.building_id
                    where b.association_id = a.id and v.unapplied_amount > 0.005), 0),
         coalesce(a.late_fee_enabled, false) and coalesce(a.late_fee_amount, 0) > 0,
         a.late_fee_amount, a.late_fee_is_percent, coalesce(a.late_fee_grace_days, 10)::integer
    from public.associations a
   where a.archived_at is null
     and public.can_manage_finance(a.portfolio_id)
     and public.can_manage_association(a.id)
   order by a.name;
$$;
revoke all on function public.receivables_task_associations() from public, anon;
grant execute on function public.receivables_task_associations() to authenticated, service_role;
