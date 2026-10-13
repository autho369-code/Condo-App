-- Speed at scale: e-signature reads check access once per query.
--
-- signature_requests_staff_read called can_manage_signatures(portfolio_id)
-- for every row (twice in the plan), and the signers/events read policies
-- ran an EXISTS into signature_requests per row with the same call. At
-- 5,000 requests (one signer and one event each) reads took 0.6-1.4 s for
-- requests and up to 4.1 s for signers and events; board members and owners,
-- who see none of them, still waited about 1 s.
--
-- can_manage_signatures(p) = can_access_portfolio(p) and the caller is
-- staff, a company admin or an operator, which is exactly the house
-- once-per-query portfolio form: portfolio_id = my_access_portfolio(), or an
-- operator and portfolio_id is not null. Signers and events read through
-- rls_private.my_signature_request_ids(): the requests that form allows,
-- narrowed to a scoped manager's associations, computed once per query.
-- Policies are altered in place (no DROP); the restrictive mgr_assoc_scope
-- policies are unchanged.

create or replace function rls_private.my_signature_request_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_op boolean := coalesce(public.is_platform_operator(), false);
  v_pf uuid := public.my_access_portfolio();
  v_scoped boolean := coalesce(public.manager_is_scoped(), false);
begin
  -- Requests signature_requests_staff_read lets the caller see.
  if not v_op and v_pf is null then
    return;
  end if;
  return query
  select r.id
    from public.signature_requests r
   where (r.portfolio_id = v_pf or (v_op and r.portfolio_id is not null))
     and (r.association_id is null
          or not v_scoped
          or r.association_id in (select public.my_managed_association_ids()));
end
$$;

revoke all on function rls_private.my_signature_request_ids() from public, anon;
grant execute on function rls_private.my_signature_request_ids() to authenticated, service_role;

alter policy signature_requests_staff_read on public.signature_requests
  using ((coalesce(portfolio_id = (select public.my_access_portfolio()), false)
          or ((select public.is_platform_operator()) and portfolio_id is not null))
         and (association_id is null
              or ((select public.manager_is_scoped()) is not true)
              or association_id in (select public.my_managed_association_ids())));

alter policy signature_signers_staff_read on public.signature_signers
  using (request_id in (select rls_private.my_signature_request_ids()));

alter policy signature_events_staff_read on public.signature_events
  using (request_id in (select rls_private.my_signature_request_ids()));
