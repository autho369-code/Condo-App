-- Association scope for the remaining finance RPCs.
--
-- These SECURITY DEFINER functions skip RLS and only checked
-- can_manage_finance(portfolio_id), so a finance user scoped to some
-- associations (association_managers; manager_is_scoped()) could act on
-- bills, checks, charges, owner statements and year-end packages of any
-- association in the company. Each now also requires
-- can_view_association_row(<the row's association>) -- the same check as the
-- restrictive mgr_assoc_scope RLS policies; it is true for users with no
-- association_managers rows (unscoped) and for company-level (null
-- association) rows. Most target tables also have <table>_association_scope
-- row triggers (20261004130000); this fails earlier, with a clear error, and
-- covers the rows those triggers don't.
-- post_recurring_journal_entries covers every association, so scoped
-- managers are refused, as post_recurring_bills already does.
-- Also scoped here (security review): save_recurring_bill's update path now
-- checks the existing row's association (it only checked the new one), and
-- advance_delinquency_case, set_delinquency_case_hold and
-- record_delinquency_board_referral_vote check the case's association
-- (delinquency_cases has no scope trigger).
-- Real gaps closed: save_/archive_recurring_bill, the delinquency RPCs and
-- post_recurring_journal_entries; for the rest the existing row triggers
-- already blocked the write and this adds an earlier, clearer refusal.
--
-- Already scoped and unchanged: post_manual_journal_entry and
-- save_/archive_recurring_journal_entry (app_normalize_je_lines /
-- app_recurring_je_in_scope), record_bank_transfer
-- (app_check_transfer_accounts), post_recurring_bills.
--
-- Each function is patched in place from its live definition
-- (pg_get_functiondef + replace, as earlier migrations do): one check is
-- inserted right after the existing permission check, and the migration
-- raises if any anchor is missing, so nothing is half-applied.
-- CREATE OR REPLACE keeps owners and grants. Additive only: no DROP, no DELETE.

do $mig$
declare d text; n text;
begin
  d := pg_get_functiondef('public.archive_recurring_bill(uuid)'::regprocedure);
  n := d;
  if position($q$if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;$q$ || $q$
  if not public.can_view_association_row((select association_id from public.recurring_bills where id = p_id)) then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;$q$ in n) = 0 then
    if position($q$if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;$q$ in n) = 0 then raise exception 'anchor not found in archive_recurring_bill'; end if;
    n := replace(n, $q$if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;$q$, $q$if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;$q$ || $q$
  if not public.can_view_association_row((select association_id from public.recurring_bills where id = p_id)) then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.create_payable_bill(uuid,uuid,uuid,uuid,uuid,text,date,date,numeric,text,boolean,boolean)'::regprocedure);
  n := d;
  if position($q$if p_portfolio_id is null or not public.can_manage_finance(p_portfolio_id) then raise exception 'Permission denied'; end if;$q$ || $q$
  if not public.can_view_association_row(p_association_id) then raise exception 'Permission denied'; end if;$q$ in n) = 0 then
    if position($q$if p_portfolio_id is null or not public.can_manage_finance(p_portfolio_id) then raise exception 'Permission denied'; end if;$q$ in n) = 0 then raise exception 'anchor not found in create_payable_bill'; end if;
    n := replace(n, $q$if p_portfolio_id is null or not public.can_manage_finance(p_portfolio_id) then raise exception 'Permission denied'; end if;$q$, $q$if p_portfolio_id is null or not public.can_manage_finance(p_portfolio_id) then raise exception 'Permission denied'; end if;$q$ || $q$
  if not public.can_view_association_row(p_association_id) then raise exception 'Permission denied'; end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.record_bill_payment(uuid,uuid[],date,text)'::regprocedure);
  n := d;
  if position($q$if not found or not public.can_manage_finance(v_bank.portfolio_id) then raise exception 'Permission denied' using errcode = '42501'; end if;$q$ || $q$
  if not public.can_view_association_row(v_bank.association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;$q$ in n) = 0 then
    if position($q$if not found or not public.can_manage_finance(v_bank.portfolio_id) then raise exception 'Permission denied' using errcode = '42501'; end if;$q$ in n) = 0 then raise exception 'anchor not found in record_bill_payment'; end if;
    n := replace(n, $q$if not found or not public.can_manage_finance(v_bank.portfolio_id) then raise exception 'Permission denied' using errcode = '42501'; end if;$q$, $q$if not found or not public.can_manage_finance(v_bank.portfolio_id) then raise exception 'Permission denied' using errcode = '42501'; end if;$q$ || $q$
  if not public.can_view_association_row(v_bank.association_id) then raise exception 'Permission denied' using errcode = '42501'; end if;$q$);
  end if;
  if position($q$if not found or v_bill.portfolio_id is distinct from v_bank.portfolio_id then raise exception 'Bill not found' using errcode = 'P0002'; end if;$q$ || $q$
    if not public.can_view_association_row(v_bill.association_id) then raise exception 'Bill not found' using errcode = 'P0002'; end if;$q$ in n) = 0 then
    if position($q$if not found or v_bill.portfolio_id is distinct from v_bank.portfolio_id then raise exception 'Bill not found' using errcode = 'P0002'; end if;$q$ in n) = 0 then raise exception 'anchor not found in record_bill_payment'; end if;
    n := replace(n, $q$if not found or v_bill.portfolio_id is distinct from v_bank.portfolio_id then raise exception 'Bill not found' using errcode = 'P0002'; end if;$q$, $q$if not found or v_bill.portfolio_id is distinct from v_bank.portfolio_id then raise exception 'Bill not found' using errcode = 'P0002'; end if;$q$ || $q$
    if not public.can_view_association_row(v_bill.association_id) then raise exception 'Bill not found' using errcode = 'P0002'; end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.record_check_run(uuid,uuid[],integer,date,boolean)'::regprocedure);
  n := d;
  if position($q$  if bank_portfolio_id is null or not public.can_manage_finance(bank_portfolio_id) then
    raise exception 'Permission denied';
  end if;$q$ || $q$
  if not public.can_view_association_row((select association_id from public.bank_accounts where id = p_bank_account_id))
     or exists (select 1 from public.payable_bills b where b.id = any(p_bill_ids) and not public.can_view_association_row(b.association_id)) then
    raise exception 'Permission denied';
  end if;$q$ in n) = 0 then
    if position($q$  if bank_portfolio_id is null or not public.can_manage_finance(bank_portfolio_id) then
    raise exception 'Permission denied';
  end if;$q$ in n) = 0 then raise exception 'anchor not found in record_check_run'; end if;
    n := replace(n, $q$  if bank_portfolio_id is null or not public.can_manage_finance(bank_portfolio_id) then
    raise exception 'Permission denied';
  end if;$q$, $q$  if bank_portfolio_id is null or not public.can_manage_finance(bank_portfolio_id) then
    raise exception 'Permission denied';
  end if;$q$ || $q$
  if not public.can_view_association_row((select association_id from public.bank_accounts where id = p_bank_account_id))
     or exists (select 1 from public.payable_bills b where b.id = any(p_bill_ids) and not public.can_view_association_row(b.association_id)) then
    raise exception 'Permission denied';
  end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.void_payable_check(uuid,text,boolean)'::regprocedure);
  n := d;
  if position($q$if not public.can_manage_finance(check_row.portfolio_id) then raise exception 'Permission denied'; end if;$q$ || $q$
  if not public.can_view_association_row(check_row.association_id) then raise exception 'Check not found'; end if;$q$ in n) = 0 then
    if position($q$if not public.can_manage_finance(check_row.portfolio_id) then raise exception 'Permission denied'; end if;$q$ in n) = 0 then raise exception 'anchor not found in void_payable_check'; end if;
    n := replace(n, $q$if not public.can_manage_finance(check_row.portfolio_id) then raise exception 'Permission denied'; end if;$q$, $q$if not public.can_manage_finance(check_row.portfolio_id) then raise exception 'Permission denied'; end if;$q$ || $q$
  if not public.can_view_association_row(check_row.association_id) then raise exception 'Check not found'; end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.bulk_create_charges(jsonb,uuid,date,text,uuid)'::regprocedure);
  n := d;
  if position($q$      raise exception 'Permission denied for unit %', charge.unit_id using errcode = '42501';
    end if;$q$ || $q$
    if not public.can_view_association_row(public.unit_association_id(charge.unit_id)) then
      raise exception 'Permission denied for unit %', charge.unit_id using errcode = '42501';
    end if;$q$ in n) = 0 then
    if position($q$      raise exception 'Permission denied for unit %', charge.unit_id using errcode = '42501';
    end if;$q$ in n) = 0 then raise exception 'anchor not found in bulk_create_charges'; end if;
    n := replace(n, $q$      raise exception 'Permission denied for unit %', charge.unit_id using errcode = '42501';
    end if;$q$, $q$      raise exception 'Permission denied for unit %', charge.unit_id using errcode = '42501';
    end if;$q$ || $q$
    if not public.can_view_association_row(public.unit_association_id(charge.unit_id)) then
      raise exception 'Permission denied for unit %', charge.unit_id using errcode = '42501';
    end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.bulk_create_recurring_charges(jsonb,uuid,text,date,text)'::regprocedure);
  n := d;
  if position($q$      raise exception 'Permission denied for unit %', sub.unit_id using errcode = '42501';
    end if;$q$ || $q$
    if not public.can_view_association_row(public.unit_association_id(sub.unit_id)) then
      raise exception 'Permission denied for unit %', sub.unit_id using errcode = '42501';
    end if;$q$ in n) = 0 then
    if position($q$      raise exception 'Permission denied for unit %', sub.unit_id using errcode = '42501';
    end if;$q$ in n) = 0 then raise exception 'anchor not found in bulk_create_recurring_charges'; end if;
    n := replace(n, $q$      raise exception 'Permission denied for unit %', sub.unit_id using errcode = '42501';
    end if;$q$, $q$      raise exception 'Permission denied for unit %', sub.unit_id using errcode = '42501';
    end if;$q$ || $q$
    if not public.can_view_association_row(public.unit_association_id(sub.unit_id)) then
      raise exception 'Permission denied for unit %', sub.unit_id using errcode = '42501';
    end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.post_recurring_journal_entries(date)'::regprocedure);
  n := d;
  if position($q$if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;$q$ || $q$
  if public.manager_is_scoped() and not public.is_company_admin() then
    raise exception 'Posting recurring journal entries covers every association. Ask a company admin or a manager with access to all associations.' using errcode = '42501';
  end if;$q$ in n) = 0 then
    if position($q$if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;$q$ in n) = 0 then raise exception 'anchor not found in post_recurring_journal_entries'; end if;
    n := replace(n, $q$if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;$q$, $q$if v_pid is null or not public.can_manage_finance(v_pid) then raise exception 'Permission denied' using errcode = '42501'; end if;$q$ || $q$
  if public.manager_is_scoped() and not public.is_company_admin() then
    raise exception 'Posting recurring journal entries covers every association. Ask a company admin or a manager with access to all associations.' using errcode = '42501';
  end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.generate_owner_statements(uuid,date,date,text,text)'::regprocedure);
  n := d;
  if position($q$  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$ || $q$
  if not public.can_view_association_row(p_association_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$ in n) = 0 then
    if position($q$  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$ in n) = 0 then raise exception 'anchor not found in generate_owner_statements'; end if;
    n := replace(n, $q$  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$, $q$  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$ || $q$
  if not public.can_view_association_row(p_association_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.mark_owner_statement_delivery(uuid,uuid[],uuid[])'::regprocedure);
  n := d;
  if position($q$  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$ || $q$
  if not public.can_view_association_row((select association_id from public.statement_batches where id = p_batch_id)) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$ in n) = 0 then
    if position($q$  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$ in n) = 0 then raise exception 'anchor not found in mark_owner_statement_delivery'; end if;
    n := replace(n, $q$  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$, $q$  if v_portfolio is null or not public.can_manage_finance(v_portfolio) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$ || $q$
  if not public.can_view_association_row((select association_id from public.statement_batches where id = p_batch_id)) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.finalize_year_end_package(uuid)'::regprocedure);
  n := d;
  if position($q$    raise exception 'Only finance staff can finalize year-end packages' using errcode = '42501';
  end if;$q$ || $q$
  if not public.can_view_association_row(pkg.association_id) then raise exception 'Package not found'; end if;$q$ in n) = 0 then
    if position($q$    raise exception 'Only finance staff can finalize year-end packages' using errcode = '42501';
  end if;$q$ in n) = 0 then raise exception 'anchor not found in finalize_year_end_package'; end if;
    n := replace(n, $q$    raise exception 'Only finance staff can finalize year-end packages' using errcode = '42501';
  end if;$q$, $q$    raise exception 'Only finance staff can finalize year-end packages' using errcode = '42501';
  end if;$q$ || $q$
  if not public.can_view_association_row(pkg.association_id) then raise exception 'Package not found'; end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.link_year_end_signature(uuid,uuid)'::regprocedure);
  n := d;
  if position($q$  if not found or not (public.can_manage_finance(pkg.portfolio_id) or public.can_admin_portfolio(pkg.portfolio_id) or public.is_platform_operator()) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$ || $q$
  if not public.can_view_association_row(pkg.association_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$ in n) = 0 then
    if position($q$  if not found or not (public.can_manage_finance(pkg.portfolio_id) or public.can_admin_portfolio(pkg.portfolio_id) or public.is_platform_operator()) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$ in n) = 0 then raise exception 'anchor not found in link_year_end_signature'; end if;
    n := replace(n, $q$  if not found or not (public.can_manage_finance(pkg.portfolio_id) or public.can_admin_portfolio(pkg.portfolio_id) or public.is_platform_operator()) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$, $q$  if not found or not (public.can_manage_finance(pkg.portfolio_id) or public.can_admin_portfolio(pkg.portfolio_id) or public.is_platform_operator()) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$ || $q$
  if not public.can_view_association_row(pkg.association_id) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.save_recurring_bill(uuid,uuid,uuid,uuid,uuid,text,text,numeric,text,integer,date,date,integer,boolean)'::regprocedure);
  n := d;
  if position($q$if not found then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;$q$ || $q$
    if not public.can_view_association_row(v_existing.association_id) then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;$q$ in n) = 0 then
    if position($q$if not found then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;$q$ in n) = 0 then raise exception 'anchor not found in save_recurring_bill'; end if;
    n := replace(n, $q$if not found then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;$q$, $q$if not found then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;$q$ || $q$
    if not public.can_view_association_row(v_existing.association_id) then raise exception 'Recurring bill not found' using errcode = 'P0002'; end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.advance_delinquency_case(uuid,text)'::regprocedure);
  n := d;
  if position($q$if not found then raise exception 'Delinquency case not found'; end if;$q$ || $q$
  if not public.can_view_association_row(case_row.association_id) then raise exception 'Delinquency case not found'; end if;$q$ in n) = 0 then
    if position($q$if not found then raise exception 'Delinquency case not found'; end if;$q$ in n) = 0 then raise exception 'anchor not found in advance_delinquency_case'; end if;
    n := replace(n, $q$if not found then raise exception 'Delinquency case not found'; end if;$q$, $q$if not found then raise exception 'Delinquency case not found'; end if;$q$ || $q$
  if not public.can_view_association_row(case_row.association_id) then raise exception 'Delinquency case not found'; end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.set_delinquency_case_hold(uuid,boolean,text)'::regprocedure);
  n := d;
  if position($q$if not found then raise exception 'Delinquency case not found'; end if;$q$ || $q$
  if not public.can_view_association_row(case_row.association_id) then raise exception 'Delinquency case not found'; end if;$q$ in n) = 0 then
    if position($q$if not found then raise exception 'Delinquency case not found'; end if;$q$ in n) = 0 then raise exception 'anchor not found in set_delinquency_case_hold'; end if;
    n := replace(n, $q$if not found then raise exception 'Delinquency case not found'; end if;$q$, $q$if not found then raise exception 'Delinquency case not found'; end if;$q$ || $q$
  if not public.can_view_association_row(case_row.association_id) then raise exception 'Delinquency case not found'; end if;$q$);
  end if;
  if n <> d then execute n; end if;

  d := pg_get_functiondef('public.record_delinquency_board_referral_vote(uuid,date,integer,integer,text)'::regprocedure);
  n := d;
  if position($q$if not found then raise exception 'Delinquency case not found'; end if;$q$ || $q$
  if not public.can_view_association_row(c.association_id) then raise exception 'Delinquency case not found'; end if;$q$ in n) = 0 then
    if position($q$if not found then raise exception 'Delinquency case not found'; end if;$q$ in n) = 0 then raise exception 'anchor not found in record_delinquency_board_referral_vote'; end if;
    n := replace(n, $q$if not found then raise exception 'Delinquency case not found'; end if;$q$, $q$if not found then raise exception 'Delinquency case not found'; end if;$q$ || $q$
  if not public.can_view_association_row(c.association_id) then raise exception 'Delinquency case not found'; end if;$q$);
  end if;
  if n <> d then execute n; end if;
end $mig$;
