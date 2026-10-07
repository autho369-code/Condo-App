-- sync_owner_delinquency_cases(p_portfolio_id) is the "Sync owner balances"
-- button on /delinquencies. It is SECURITY DEFINER and checked only the
-- portfolio, and delinquency_cases has no association-scope trigger, so a
-- manager limited to some associations (association_managers) created,
-- reopened and resolved collection cases in every association of the company.
-- Now both the case upsert and the "cured" sweep only touch associations the
-- caller can see (can_view_association_row: true for unscoped staff, company
-- admins without association_managers rows, and jobs), so scoped managers can
-- still sync their own associations.
--
-- Patched in place from the live definition (pg_get_functiondef + replace);
-- idempotent, raises if an anchor is missing. CREATE OR REPLACE keeps owner
-- and grants. Additive only: no DROP, no DELETE.

do $mig$
declare d text; n text;
begin
  d := pg_get_functiondef('public.sync_owner_delinquency_cases(uuid)'::regprocedure);
  n := d;
  if position($q$    and due.unit_id is not null
    and public.can_view_association_row(due.association_id)$q$ in n) = 0 then
    if position($q$    and due.unit_id is not null$q$ in n) = 0 then raise exception 'anchor not found in sync_owner_delinquency_cases (upsert)'; end if;
    n := replace(n, $q$    and due.unit_id is not null$q$, $q$    and due.unit_id is not null
    and public.can_view_association_row(due.association_id)$q$);
  end if;
  if position($q$      and case_record.status not in ('resolved', 'closed')
      and public.can_view_association_row(case_record.association_id)$q$ in n) = 0 then
    if position($q$      and case_record.status not in ('resolved', 'closed')$q$ in n) = 0 then raise exception 'anchor not found in sync_owner_delinquency_cases (cured)'; end if;
    n := replace(n, $q$      and case_record.status not in ('resolved', 'closed')$q$, $q$      and case_record.status not in ('resolved', 'closed')
      and public.can_view_association_row(case_record.association_id)$q$);
  end if;
  if n <> d then execute n; end if;
end $mig$;
