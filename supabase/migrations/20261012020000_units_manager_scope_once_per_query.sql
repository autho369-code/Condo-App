-- units: the manager-scope policy no longer calls a function once per row.
--
-- mgr_assoc_scope on units was the only one of the 88 mgr_assoc_scope
-- policies still written as can_view_association_row(<building's
-- association>). That calls a SECURITY DEFINER PL/pgSQL function (and
-- manager_is_scoped() inside it) for every row, for every role. Measured on
-- production in a rolled-back transaction with 5,000 extra units: every
-- read of units took 330-390 ms (owner with 1 visible unit: 341 ms; no RLS:
-- 0.4 ms). Rewritten in the once-per-query form the other 87 tables use:
-- 4.8 ms unscoped manager, 16.5 ms scoped manager, 5.9 ms owner, 13 ms board,
-- 8.5 ms vendor.
--
-- Same rows for everyone (checked old vs new with a second association and
-- a manager assigned to one association only): unscoped staff and other
-- roles pass the first branch; a scoped manager sees units whose building
-- is in one of their associations, or has no association (the function
-- treated a null association as visible).

set local lock_timeout = '5s';

alter policy mgr_assoc_scope on public.units
  using (
    ((select public.manager_is_scoped()) is not true)
    or coalesce(
      (select b.association_id from public.buildings b where b.id = units.building_id)
        in (select public.my_managed_association_ids()),
      true
    )
  );
