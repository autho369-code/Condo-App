-- Manager scope on the remaining association tables.
--
-- A manager assigned to some associations (association_managers) sees only
-- those: 88 tables carry the restrictive policy mgr_assoc_scope. 35 tables
-- with an association_id column did not, so a scoped manager could read
-- (and where the staff policy allows, change) rows of the company's other
-- associations there: budget lines and budgets, capital projects, reserve
-- studies, delinquency cases and policies, payment plans, late-fee and
-- interest assessments, payable checks, credit cards, payment methods and
-- intents, surveys, amenity reservations, mail deliveries and more. Found
-- 2026-10-12 (budget_lines); on production no manager was scoped yet, so
-- nobody saw anything they should not have.
--
-- Same policy and form as the other 88 tables (once per query): unscoped
-- staff and every other role pass the first branch; rows without an
-- association (company-level) stay visible; a scoped manager sees their
-- associations' rows. Restrictive, so where a table already scoped managers
-- in its own policy nothing changes.

do $$
declare
  t text;
begin
  foreach t in array array[
    'amenity_reservations', 'association_board_report_settings', 'association_budgets',
    'association_insurance_policies', 'association_private', 'association_vendor_private',
    'association_violation_settings', 'automation_flows', 'board_role_permissions',
    'budget_lines', 'capital_projects', 'credit_card_accounts', 'credit_card_charges',
    'delinquency_cases', 'delinquency_policies', 'gl_account_map', 'interest_assessments',
    'inventory_movements', 'late_fee_assessments', 'payable_checks', 'payment_intents',
    'payment_methods', 'payment_plans', 'payout_batches', 'physical_mail_deliveries',
    'reserve_components', 'reserve_fund_settings', 'reserve_funding_scenarios',
    'reserve_studies', 'signature_requests', 'stripe_setup_attempts', 'surveys',
    'unit_groups', 'vendor_credits', 'year_end_packages'
  ] loop
    if not exists (
      select 1 from pg_policies
       where schemaname = 'public' and tablename = t and policyname = 'mgr_assoc_scope'
    ) then
      execute format(
        'create policy mgr_assoc_scope on public.%I as restrictive for all to authenticated '
        || 'using (((select public.manager_is_scoped()) is not true) or association_id is null '
        || 'or association_id in (select public.my_managed_association_ids()))',
        t);
    end if;
  end loop;
end
$$;

-- Tables tied to an association only through a unit, a bank account or
-- journal lines (security-reviewer on this PR): charges and payments (every
-- homeowner ledger), unit_owners and tenancies (owner and renter links),
-- parking assignments, bank transactions, reconciliations and Plaid links.
-- Their parents (units, bank_accounts)
-- already carry mgr_assoc_scope; the subqueries below run under the caller's
-- row-level security, so a scoped manager passes only for rows of a unit,
-- bank account they can see. Unscoped callers pass the first branch.
-- journal_entries is left out: journal_lines (already scoped) policies read
-- journal_entries, so a policy on entries reading lines recurses. Lines are
-- scoped; entry headers carry date, description and reference only.

do $$
declare
  t text;
begin
  foreach t in array array['charges', 'payments', 'unit_owners', 'tenancies', 'parking_assignments'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'mgr_assoc_scope') then
      execute format(
        'create policy mgr_assoc_scope on public.%I as restrictive for all to authenticated '
        || 'using (((select public.manager_is_scoped()) is not true) or unit_id is null '
        || 'or unit_id in (select u.id from public.units u))',
        t);
    end if;
  end loop;

  foreach t in array array['bank_transactions', 'bank_reconciliations', 'plaid_items'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'mgr_assoc_scope') then
      execute format(
        'create policy mgr_assoc_scope on public.%I as restrictive for all to authenticated '
        || 'using (((select public.manager_is_scoped()) is not true) or bank_account_id is null '
        || 'or bank_account_id in (select ba.id from public.bank_accounts ba))',
        t);
    end if;
  end loop;

end
$$;
