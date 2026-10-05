-- user_roles holds each client company's custom staff roles and their
-- permission settings (gl_account_permissions, profile_access). The read
-- policy was `true` for every signed-in user, so any client's staff, owners,
-- board members or vendors could read every other client's role setup.
-- Shared roles (portfolio_id null) stay readable to everyone; a client's own
-- roles only to that client; Portier369 operators see all. The role-check
-- helpers (has_role, is_full_access_staff, is_finance_staff, ...) are
-- SECURITY DEFINER and unaffected.
alter policy user_roles_authenticated_read on public.user_roles
  using (portfolio_id is null or portfolio_id = current_portfolio_id() or is_platform_operator());
