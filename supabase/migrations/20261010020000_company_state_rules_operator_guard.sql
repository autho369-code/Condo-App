-- company_state_rules (20261010010000) missed the operator write guard every
-- company data table carries: its write policies use can_admin_portfolio,
-- which is true for any platform operator, so a support or read-only operator
-- could change a company's state rules through the API (the app action
-- refuses operators; the database did not). Same guard as delinquency_policies.

drop trigger if exists operator_write_guard on public.company_state_rules;
create trigger operator_write_guard
  before insert or update or delete on public.company_state_rules
  for each statement execute function public.operator_write_guard('false');
