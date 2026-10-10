-- Comments only. Since 20261011010000-30000 the public policies no longer
-- call these helpers; they use once-per-query forms instead. A change to
-- one of these bodies must also change its twin (and the policies that
-- inline it), or the two drift apart. Storage policies still call the
-- originals.

comment on function public.can_access_portfolio(uuid) is
  'Policies use the twin: COALESCE(x = (select my_access_portfolio()), false) OR ((select is_platform_operator()) AND x IS NOT NULL). Change both together (20261011010000).';
comment on function public.can_manage_finance(uuid) is
  'Policies use the twin: COALESCE(x = (select my_finance_portfolio()), false) OR ((select is_platform_operator()) AND x IS NOT NULL). Change both together (20261011010000).';
comment on function public.can_admin_portfolio(uuid) is
  'Policies use the twin: COALESCE(x = (select my_admin_portfolio()), false) OR ((select is_platform_operator_safe()) AND x IS NOT NULL). Change both together (20261011010000).';
comment on function public.can_access_association(uuid) is
  'Policies use the twin: x IN (select my_accessible_association_ids()). Change both together (20261011010000, 20261011030000).';
comment on function public.can_view_association_row(uuid) is
  'Policies inline this as: (select manager_is_scoped()) IS NOT TRUE OR x IS NULL OR x IN (select my_managed_association_ids()). Change both together (20261011010000).';
comment on function public.can_read_gl(uuid) is
  'Policies use the twin: (select gl_read_all()) OR x IN (select my_readable_gl_ids()). Change both together (20261011020000).';
comment on function public.can_access_unit(uuid) is
  'Policies use the twin: x IN (select my_accessible_unit_ids()). Change both together (20261011020000).';
comment on function public.can_manage_association(uuid) is
  'Policies use the twin: x IN (select my_manageable_association_ids()). Change both together (20261011020000).';
comment on function public.can_edit_association_mvp(uuid) is
  'Policies use the twin: ((select is_platform_operator()) AND x IS NOT NULL) OR x IN (select my_editable_association_ids()). Change both together (20261011020000).';
comment on function public.can_write_vendor_row(uuid) is
  'Policies inline this body: x IS NOT NULL OR NOT (select manager_is_scoped()) OR (select is_company_admin()). Change both together (20261011020000).';
