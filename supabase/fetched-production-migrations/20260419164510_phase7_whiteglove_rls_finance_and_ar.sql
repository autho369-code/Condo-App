-- =============================================================================
-- Phase 7 — White-glove RLS, part 1/2: Finance + AR + Admin
-- Replaces the flat `is_manager()`-all policies with tiered AppFolio access.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TIER B — Finance tables (President, Property Manager, Accountant, AP)
-- -----------------------------------------------------------------------------

-- gl_accounts
drop policy if exists gl_accounts_manager_all on public.gl_accounts;
create policy gl_accounts_finance_all on public.gl_accounts
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());
create policy gl_accounts_board_read on public.gl_accounts
  for select to authenticated
  using (public.is_board_user() and (association_id is null or association_id in (select public.current_board_association_ids())));

-- gl_account_role_permissions
drop policy if exists gl_role_perms_manager_all on public.gl_account_role_permissions;
create policy gl_role_perms_full_all on public.gl_account_role_permissions
  for all to authenticated using (public.is_full_access_staff()) with check (public.is_full_access_staff());
create policy gl_role_perms_staff_read on public.gl_account_role_permissions
  for select to authenticated using (public.is_staff());

-- bank_accounts
drop policy if exists bank_accounts_manager_all on public.bank_accounts;
create policy bank_accounts_finance_all on public.bank_accounts
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());

-- bank_account_owners
drop policy if exists bank_owners_manager_all on public.bank_account_owners;
create policy bank_owners_finance_all on public.bank_account_owners
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());

-- bank_transfers
drop policy if exists bank_transfers_manager_all on public.bank_transfers;
create policy bank_transfers_finance_all on public.bank_transfers
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());

-- journal_entries
drop policy if exists journal_entries_manager_all on public.journal_entries;
create policy journal_entries_finance_all on public.journal_entries
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());

-- journal_lines
drop policy if exists journal_lines_manager_all on public.journal_lines;
create policy journal_lines_finance_all on public.journal_lines
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());

-- budget_lines
drop policy if exists budget_lines_manager_all on public.budget_lines;
create policy budget_lines_finance_all on public.budget_lines
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());
create policy budget_lines_board_read on public.budget_lines
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));

-- payable_bills
drop policy if exists payable_bills_manager_all on public.payable_bills;
create policy payable_bills_finance_all on public.payable_bills
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());
create policy payable_bills_vendor_read on public.payable_bills
  for select to authenticated
  using (vendor_id = public.current_vendor_id());

-- payable_bill_line_items
drop policy if exists bill_line_items_manager_all on public.payable_bill_line_items;
create policy bill_line_items_finance_all on public.payable_bill_line_items
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());

-- management_fee_schedules
drop policy if exists mgmt_fee_manager_all on public.management_fee_schedules;
create policy mgmt_fee_full_all on public.management_fee_schedules
  for all to authenticated using (public.is_full_access_staff()) with check (public.is_full_access_staff());
create policy mgmt_fee_finance_read on public.management_fee_schedules
  for select to authenticated using (public.is_finance_staff());

-- fixed_assets
drop policy if exists fixed_assets_manager_all on public.fixed_assets;
create policy fixed_assets_finance_all on public.fixed_assets
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());
create policy fixed_assets_board_read on public.fixed_assets
  for select to authenticated
  using (public.is_board_user() and (association_id is null or association_id in (select public.current_board_association_ids())));

-- depreciation_entries
drop policy if exists depr_entries_manager_all on public.depreciation_entries;
create policy depr_entries_finance_all on public.depreciation_entries
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());

-- -----------------------------------------------------------------------------
-- TIER AR — Charges, payments, statements (finance + homeowner portal)
-- -----------------------------------------------------------------------------

-- charges
drop policy if exists charges_manager_all on public.charges;
drop policy if exists charges_board_read on public.charges;
drop policy if exists charges_owner_read on public.charges;
drop policy if exists charges_tenant_read on public.charges;
create policy charges_finance_all on public.charges
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());
create policy charges_board_read on public.charges
  for select to authenticated
  using (public.is_board_user() and unit_id in (
    select u.id from public.units u
    join public.buildings b on b.id = u.building_id
    where b.association_id in (select public.current_board_association_ids())
  ));
create policy charges_resident_read on public.charges
  for select to authenticated
  using (public.is_portal_resident() and unit_id in (select public.current_resident_unit_ids()));

-- payments
drop policy if exists payments_manager_all on public.payments;
drop policy if exists payments_board_read on public.payments;
drop policy if exists payments_owner_read on public.payments;
create policy payments_finance_all on public.payments
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());
create policy payments_board_read on public.payments
  for select to authenticated
  using (public.is_board_user() and unit_id in (
    select u.id from public.units u
    join public.buildings b on b.id = u.building_id
    where b.association_id in (select public.current_board_association_ids())
  ));
create policy payments_resident_read on public.payments
  for select to authenticated
  using (public.is_portal_resident() and unit_id in (select public.current_resident_unit_ids()));

-- payment_intents (Stripe)
drop policy if exists manager_payment_intents_all on public.payment_intents;
drop policy if exists owner_payment_intents_insert on public.payment_intents;
drop policy if exists owner_payment_intents_read on public.payment_intents;
create policy payment_intents_finance_all on public.payment_intents
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());
create policy payment_intents_resident_read on public.payment_intents
  for select to authenticated
  using (public.is_portal_resident() and owner_id = public.current_owner_id());
create policy payment_intents_resident_insert on public.payment_intents
  for insert to authenticated
  with check (public.is_portal_resident() and owner_id = public.current_owner_id() and unit_id in (select public.current_resident_unit_ids()));

-- statements
drop policy if exists manager_statements_all on public.statements;
drop policy if exists board_statements_read on public.statements;
drop policy if exists owner_statements_read on public.statements;
create policy statements_finance_all on public.statements
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());
create policy statements_board_read on public.statements
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));
create policy statements_resident_read on public.statements
  for select to authenticated
  using (public.is_portal_resident() and (owner_id = public.current_owner_id() or unit_id in (select public.current_resident_unit_ids())));

-- assessment_periods
drop policy if exists ap_manager_all on public.assessment_periods;
drop policy if exists ap_board_read on public.assessment_periods;
drop policy if exists ap_owner_read on public.assessment_periods;
create policy assessment_periods_finance_all on public.assessment_periods
  for all to authenticated using (public.is_finance_staff()) with check (public.is_finance_staff());
create policy assessment_periods_board_read on public.assessment_periods
  for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));
create policy assessment_periods_resident_read on public.assessment_periods
  for select to authenticated
  using (public.is_portal_resident() and association_id in (select public.current_resident_association_ids()));

-- -----------------------------------------------------------------------------
-- ADMIN — portfolios, property_groups, user_roles (full access staff only)
-- -----------------------------------------------------------------------------

drop policy if exists portfolios_manager_all on public.portfolios;
create policy portfolios_full_all on public.portfolios
  for all to authenticated using (public.is_full_access_staff()) with check (public.is_full_access_staff());
create policy portfolios_staff_read on public.portfolios
  for select to authenticated using (public.is_staff());

drop policy if exists property_groups_manager_all on public.property_groups;
create policy property_groups_full_all on public.property_groups
  for all to authenticated using (public.is_full_access_staff()) with check (public.is_full_access_staff());
create policy property_groups_staff_read on public.property_groups
  for select to authenticated using (public.is_staff());

-- user_roles already has user_roles_manager_all + user_roles_authenticated_read
drop policy if exists user_roles_manager_all on public.user_roles;
create policy user_roles_full_all on public.user_roles
  for all to authenticated using (public.is_full_access_staff()) with check (public.is_full_access_staff());
-- user_roles_authenticated_read already exists; it lets everyone read role definitions (needed by UI)
;
