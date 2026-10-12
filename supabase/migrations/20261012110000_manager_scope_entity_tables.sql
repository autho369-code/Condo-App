-- Manager scope on tables that point at a record by type + id.
--
-- 20261012090000/100000 scoped tables linked to an association by a column
-- or a foreign key. Seven tables name their record with entity_type +
-- entity_id instead, so a manager assigned to some associations could still
-- reach other associations' records there (security-reviewer on #331):
--   documents (owner/unit/tenant files: list, download, edit; only
--     association documents were scoped), record_notes and tag_assignments
--     (note bodies, tags), audit_logs (owner field changes incl. contact
--     data), sms_opt_ins (phones; writable) and sms_consent_events,
--     data_diagnostics.
-- soft_delete_log (archived row copies) names its record by table name;
-- it is scoped by the association_id in the archived row (units by their
-- building, tenancies by their unit).
--
-- The policy resolves the record by type: a scoped manager passes only if
-- that record is visible to them (each subquery runs under the caller's
-- row-level security; every parent carries mgr_assoc_scope). Company-level
-- types (company, user, journal_entry_batch, ...) and rows without a record
-- stay visible. Unscoped callers pass the first branch. No manager was
-- scoped on production yet.

do $$
declare
  -- entity_type -> the scoped table (or set) that decides visibility
  map constant jsonb := jsonb_build_object(
    'association', 'select public.my_managed_association_ids()',
    'unit', 'select x.id from public.units x',
    'owner', 'select x.id from public.owners x',
    'tenant', 'select x.id from public.tenants x',
    'vendor', 'select x.id from public.vendors x',
    'board_member', 'select x.id from public.board_members x',
    'work_order', 'select x.id from public.work_orders x',
    'service_request', 'select x.id from public.service_requests x',
    'bill', 'select x.id from public.payable_bills x',
    'payment', 'select x.id from public.payments x',
    'charge', 'select x.id from public.charges x',
    'violation', 'select x.id from public.violations x',
    'document', 'select x.id from public.documents x',
    'inspection', 'select x.id from public.inspections x',
    'calendar_event', 'select x.id from public.calendar_events x',
    'bank_account', 'select x.id from public.bank_accounts x',
    -- document storage paths also use these two types
    'architectural', 'select x.id from public.architectural_requests x',
    'meeting', 'select x.id from public.meetings x',
    -- audit_logs entity types
    'payable_bill', 'select x.id from public.payable_bills x',
    'recurring_bill', 'select x.id from public.recurring_bills x',
    'payment_plan', 'select x.id from public.payment_plans x',
    'owner_payable', 'select x.id from public.owner_payables x',
    'bank_deposit', 'select x.id from public.bank_deposits x',
    'bank_transfer', 'select x.id from public.bank_transfers x',
    'lockbox_batch', 'select x.id from public.lockbox_batches x',
    'recurring_purchase_order', 'select x.id from public.recurring_purchase_orders x',
    'dues_increase', 'select x.id from public.dues_increases x',
    'physical_mail_delivery', 'select x.id from public.physical_mail_deliveries x',
    -- journal entries are visible through their (scoped) lines
    'journal_entry', 'select x.entry_id from public.journal_lines x'
  );
  r record;
  branches text;
  expr text;
  k text;
begin
  for r in
    select * from (values
      ('documents', 'entity_type'),
      ('record_notes', 'entity_type'),
      ('tag_assignments', 'entity_type::text'),
      ('audit_logs', 'entity_type'),
      ('sms_opt_ins', 'entity_type'),
      ('sms_consent_events', 'entity_type'),
      ('data_diagnostics', 'entity_type')
    ) v(tbl, type_expr)
  loop
    branches := '';
    for k in select jsonb_object_keys(map) order by 1 loop
      -- documents must not read documents (self-reference).
      continue when r.tbl = 'documents' and k = 'document';
      branches := branches || format(' when %L then entity_id in (%s)', k, map ->> k);
    end loop;
    expr := format(
      '((select public.manager_is_scoped()) is not true) or entity_id is null or (case %s%s else true end)',
      r.type_expr, branches);

    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.tbl and policyname = 'mgr_assoc_scope') then
      -- ALTER POLICY ... USING keeps an existing WITH CHECK; replace both.
      execute format('alter policy mgr_assoc_scope on public.%I using (%s) with check (%s)', r.tbl, expr, expr);
    else
      execute format('create policy mgr_assoc_scope on public.%I as restrictive for all to authenticated using (%s)', r.tbl, expr);
    end if;
  end loop;

  -- soft_delete_log: by the archived row's association (or the association
  -- itself when an association was archived).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'soft_delete_log' and policyname = 'mgr_assoc_scope') then
    create policy mgr_assoc_scope on public.soft_delete_log as restrictive for all to authenticated
      using (((select public.manager_is_scoped()) is not true)
             or (entity_type = 'associations' and entity_id in (select public.my_managed_association_ids()))
             or (entity_type = 'units'
                 and (prior_state ->> 'building_id')::uuid in (select b.id from public.buildings b))
             or (entity_type = 'tenancies'
                 and (prior_state ->> 'unit_id')::uuid in (select u.id from public.units u))
             or (entity_type not in ('associations', 'units', 'tenancies')
                 and (prior_state ->> 'association_id' is null
                      or (prior_state ->> 'association_id')::uuid in (select public.my_managed_association_ids()))));
  end if;
end
$$;
