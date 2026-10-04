-- Security audit of every SECURITY DEFINER RPC (2026-10-04). No cross-company
-- hole was found; these close the gaps inside one company and a few small
-- cross-company lookups.
--
-- 1. Managers limited to some associations (association_managers) could write
--    to other associations of their company through RPCs that only checked
--    can_manage_finance(portfolio): bulk charges, recurring charges, dues
--    increases, owner statements, board-approval settings, notes, tags,
--    signature requests, year-end packages, lockbox payments. A row-level
--    trigger (same rule as payable_bills_association_scope) now blocks any
--    write a scoped manager makes outside their associations, whichever RPC
--    makes it. Owners, board members, unscoped staff and jobs pass unchanged.
-- 2. Functions that read before writing get their own check.
-- 3. me() returned the whole portfolios row (tax id, security policy,
--    management-fee setup) to owners, tenants, board members and vendors.
-- 4. Fee/processor lookups that took any portfolio or association id are no
--    longer callable by signed-in users (no app caller; definer code keeps them).

-- ── 1. Association scope on writes ──────────────────────────────────────────
create or replace function public.row_association_id(p_row jsonb)
returns uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select case
    when p_row is null then null
    when p_row ? 'association_id' and p_row->>'association_id' is not null then (p_row->>'association_id')::uuid
    when p_row ? 'unit_id' and p_row->>'unit_id' is not null then public.unit_association_id((p_row->>'unit_id')::uuid)
    when p_row ? 'entity_type' and lower(p_row->>'entity_type') = 'association' then (p_row->>'entity_id')::uuid
    when p_row ? 'entity_type' and lower(p_row->>'entity_type') = 'unit' then public.unit_association_id((p_row->>'entity_id')::uuid)
  end
$$;
revoke all on function public.row_association_id(jsonb) from public, anon, authenticated;

create or replace function public.enforce_row_association_scope()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  n jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  o jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  a uuid;
begin
  if auth.uid() is null or not public.manager_is_scoped() then return coalesce(new, old); end if;  -- jobs, unscoped users
  foreach a in array array[public.row_association_id(n), public.row_association_id(o)] loop
    if a is not null and not public.can_view_association_row(a) then
      raise exception 'You do not manage this association' using errcode = '42501';
    end if;
  end loop;
  -- Notes and tags on an owner record follow the owner's associations.
  if coalesce(lower(n->>'entity_type'), lower(o->>'entity_type')) = 'owner'
     and not public.can_view_owner_row(coalesce(n->>'entity_id', o->>'entity_id')::uuid) then
    raise exception 'You do not manage this owner' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public.enforce_row_association_scope() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['charges', 'unit_recurring_charges', 'occupancies', 'owner_statements',
                           'statement_batches', 'board_approval_settings', 'record_notes',
                           'tag_assignments', 'signature_requests', 'year_end_packages', 'payments'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_association_scope' and tgrelid = ('public.' || t)::regclass) then
      execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_row_association_scope()',
                     t || '_association_scope', t);
    end if;
  end loop;
end $$;

-- ── 2. Read-then-write functions ────────────────────────────────────────────
-- Budget writes (and the dues-increase preview, which lists owners and dues).
create or replace function public.can_mutate_association_budget(p_association_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.associations a
       where a.id = p_association_id
         and (public.is_platform_operator()
              or (public.can_manage_finance(a.portfolio_id)
                  and public.can_access_association(a.id)
                  and public.can_view_association_row(a.id)))
    );
$$;

create or replace function public.apply_dues_increase_checked(p_association_id uuid, p_charge_category_id uuid, p_mode text, p_value numeric, p_effective_date date, p_apply boolean DEFAULT false, p_expected jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_preview jsonb;
  v_now text[];
  v_expected text[];
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not public.can_mutate_association_budget(p_association_id) then
    raise exception 'Permission denied for this association' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.charge_categories c
     where c.id = p_charge_category_id
       and c.active and c.archived_at is null
       and c.charge_type in ('assessment', 'special_assessment')
       and (c.association_id is null or c.association_id = p_association_id)
  ) then
    raise exception 'Choose an active assessment charge for this association' using errcode = '22023';
  end if;

  v_preview := public.apply_dues_increase(p_association_id, p_charge_category_id, p_mode, p_value, p_effective_date, false);
  if not p_apply then return v_preview; end if;

  if p_expected is null or jsonb_typeof(p_expected) <> 'array' then
    raise exception 'Preview the increase before applying it' using errcode = '22023';
  end if;
  select coalesce(array_agg(k order by k), '{}') into v_expected
    from (select (e->>'recurring_id') || ':' || round((e->>'old_amount')::numeric, 2)::text as k
            from jsonb_array_elements(p_expected) e) x;
  select coalesce(array_agg(k order by k), '{}') into v_now
    from (select (e->>'recurring_id') || ':' || round((e->>'old_amount')::numeric, 2)::text as k
            from jsonb_array_elements(v_preview) e) x;
  if v_expected is distinct from v_now then
    raise exception 'The dues changed since you previewed (or this increase was already applied). Preview again before applying.' using errcode = '40001';
  end if;

  return public.apply_dues_increase(p_association_id, p_charge_category_id, p_mode, p_value, p_effective_date, true);
end;
$function$;

-- Company-wide recurring-bill posting is for managers who see every association.
create or replace function public.post_recurring_bills(p_through date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_pid uuid := public.current_portfolio_id();
  n integer;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then
    raise exception 'Permission denied' using errcode = '42501';
  end if;
  if public.manager_is_scoped() and not public.is_company_admin() then
    raise exception 'Posting recurring bills covers every association. Ask a company admin or a manager with access to all associations.' using errcode = '42501';
  end if;
  if p_through is null then raise exception 'Choose a post-through date' using errcode = '22023'; end if;
  if p_through > current_date + 366 then
    raise exception 'Post-through date can be at most a year ahead' using errcode = '22023';
  end if;
  n := public.generate_recurring_bills_through(v_pid, p_through, true);
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_pid, 'recurring_bill', null, 'posted', auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('through', p_through, 'bills', n));
  return n;
end $function$;

create or replace function public.ensure_payable_bill_accrual(p_bill_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  bill_row public.payable_bills;
  ap_account_id uuid;
  entry_id uuid;
begin
  select * into bill_row from public.payable_bills where id = p_bill_id for update;
  if not found then raise exception 'Bill not found'; end if;
  if coalesce(auth.role(), '') not in ('', 'service_role')
     and not (public.can_manage_finance(bill_row.portfolio_id) and public.can_view_association_row(bill_row.association_id)) then
    raise exception 'Permission denied';
  end if;
  if bill_row.status not in ('approved'::public.payable_bill_status, 'paid'::public.payable_bill_status) then
    raise exception 'Bill must be approved before posting';
  end if;
  if bill_row.association_id is null or bill_row.gl_account_id is null then
    raise exception 'Bill requires an association and expense GL account before posting';
  end if;

  select id into entry_id from public.journal_entries
   where source_type = 'payable_bill' and source_id = p_bill_id;
  if found then return entry_id; end if;

  perform 1 from public.gl_accounts
   where id = bill_row.gl_account_id
     and portfolio_id = bill_row.portfolio_id
     and active
     and (association_id is null or association_id = bill_row.association_id);
  if not found then raise exception 'Bill expense GL account is not active in this portfolio/association'; end if;

  ap_account_id := public.app_ap_account(bill_row.portfolio_id, bill_row.association_id);
  if ap_account_id is null then raise exception 'No active Accounts Payable GL account is configured'; end if;

  insert into public.journal_entries (
    portfolio_id, entry_date, description, memo, reference_number,
    source_type, source_id, created_by, posted, posted_at
  ) values (
    bill_row.portfolio_id, bill_row.bill_date,
    'Bill accrued: ' || coalesce(bill_row.bill_number, p_bill_id::text), bill_row.memo,
    bill_row.bill_number, 'payable_bill', p_bill_id, coalesce(auth.uid(), bill_row.created_by), true, now()
  ) returning id into entry_id;

  insert into public.journal_lines (entry_id, association_id, gl_account_id, debit_amount, credit_amount, memo, sort_order)
  values
    (entry_id, bill_row.association_id, bill_row.gl_account_id, bill_row.amount, 0, bill_row.memo, 1),
    (entry_id, bill_row.association_id, ap_account_id, 0, bill_row.amount, bill_row.memo, 2);
  return entry_id;
end $function$;

create or replace function public.record_delinquency_payment_plan_offer(p_case_id uuid, p_offered_on date, p_months integer, p_terms text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare c public.delinquency_cases;
begin
  select * into c from public.delinquency_cases where id = p_case_id for update;
  if not found then raise exception 'Delinquency case not found'; end if;
  if not (public.can_access_portfolio(c.portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
          and public.can_view_association_row(c.association_id)) then
    raise exception 'Not authorized to manage this delinquency case';
  end if;
  if p_offered_on is null or p_offered_on > current_date then raise exception 'Offer date must be today or earlier'; end if;
  if p_months is null or p_months not between 1 and 60 then raise exception 'Plan length must be 1–60 months'; end if;
  if char_length(btrim(coalesce(p_terms, ''))) < 10 then raise exception 'Describe the offered terms (10+ characters)'; end if;
  insert into public.delinquency_case_events (case_id, event_type, step_number, balance_snapshot, note, metadata)
  values (p_case_id, 'payment_plan_offered', c.current_step_number, c.balance_snapshot, left(btrim(p_terms), 2000), jsonb_build_object('offered_on', p_offered_on, 'months', p_months));
end;
$function$;

create or replace function public.delinquency_referral_readiness(p_case_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare c public.delinquency_cases; p public.delinquency_policies; warnings text[] := '{}';
begin
  select * into c from public.delinquency_cases where id = p_case_id;
  if not found then raise exception 'Delinquency case not found'; end if;
  if not (public.can_access_portfolio(c.portfolio_id) and (public.is_any_staff() or public.is_company_admin() or public.is_platform_operator())
          and public.can_view_association_row(c.association_id)) then
    raise exception 'Not authorized to view this delinquency case';
  end if;
  select * into p from public.delinquency_policies where id = c.policy_id;
  if p.foreclosure_min_balance is not null and c.balance_snapshot < p.foreclosure_min_balance then
    warnings := warnings || format('Balance is below the $%s foreclosure threshold for %s — lien or other remedies only', to_char(p.foreclosure_min_balance, 'FM999,990'), coalesce(p.jurisdiction, 'this jurisdiction'));
  end if;
  if p.foreclosure_min_months is not null and c.oldest_due_date is not null and c.oldest_due_date > current_date - make_interval(months => p.foreclosure_min_months) then
    warnings := warnings || format('Delinquent less than %s months — below the foreclosure threshold for %s', p.foreclosure_min_months, coalesce(p.jurisdiction, 'this jurisdiction'));
  end if;
  return jsonb_build_object('blockers', to_jsonb(public.delinquency_referral_blockers(p_case_id)), 'warnings', to_jsonb(warnings), 'jurisdiction', p.jurisdiction);
end;
$function$;

-- ── 3. me(): full company row for staff only ────────────────────────────────
create or replace function public.me()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select jsonb_build_object(
    'auth_user_id', auth.uid(),
    'email', (select email from auth.users where id = auth.uid()),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'portfolio', (
      select case
        when public.is_any_staff() or public.is_company_admin() or public.is_platform_operator()
          then to_jsonb(po) - 'ai_api_key' - 'ai_api_key_ciphertext' - 'ai_endpoint'
        -- Owners, tenants, board members and vendors: branding and contact only.
        else jsonb_build_object(
          'id', po.id, 'company_name', po.company_name, 'slug', po.slug,
          'logo_url', po.logo_url, 'favicon_url', po.favicon_url, 'brand_color', po.brand_color,
          'brand_email', po.brand_email, 'website', po.website, 'public_website', po.public_website,
          'phone_number', po.phone_number, 'texting_phone_number', po.texting_phone_number,
          'support_email', po.support_email, 'support_phone', po.support_phone,
          'address_street', po.address_street, 'address_city', po.address_city,
          'address_state', po.address_state, 'address_zip', po.address_zip,
          'archived_at', po.archived_at, 'suspended_at', po.suspended_at)
      end
      from public.portfolios po
      where po.id = public.current_portfolio_id()
    ),
    'role_name', public.current_role_name(),
    'is_platform_operator', public.is_platform_operator(),
    'is_company_admin', public.is_company_admin(),
    'is_full_access_staff', public.is_full_access_staff(),
    'is_finance_staff', public.is_finance_staff(),
    'is_staff', public.is_staff(),
    'is_board', public.is_board_user(),
    'is_resident', public.is_portal_resident(),
    'is_tenant', public.is_tenant_user(),
    'owner_id', public.current_owner_id(),
    'tenant_id', public.current_tenant_id(),
    'vendor_id', public.current_vendor_id(),
    'board_association_ids', array(select public.current_board_association_ids()),
    'resident_association_ids', array(select public.current_resident_association_ids()),
    'resident_unit_ids', array(select public.current_resident_unit_ids()),
    'tenant_association_ids', array(select public.current_tenant_association_ids()),
    'tenant_unit_ids', array(select public.current_tenant_unit_ids())
  );
$function$;

-- ── 4. Cross-company lookups ────────────────────────────────────────────────
create or replace function public.has_entitlement(p_portfolio_id uuid, p_feature_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select (auth.uid() is null or public.can_access_portfolio(p_portfolio_id) or public.is_platform_operator())
    and exists (
    select 1
      from public.portfolios p
      join public.feature_entitlements fe on true
     where p.id = p_portfolio_id
       and fe.key = p_feature_key
       and case
             when fe.min_tier = 'foundation' then true
             when fe.min_tier = 'growth' then p.tier in ('growth','portfolio','enterprise')
             when fe.min_tier = 'portfolio' then p.tier in ('portfolio','enterprise')
             when fe.min_tier = 'enterprise' then p.tier = 'enterprise'
           end
       and p.suspended_at is null
  );
$function$;

revoke execute on function public.calculate_convenience_fee(uuid, bigint, text) from public, anon, authenticated;
revoke execute on function public.select_payment_processor(uuid, text) from public, anon, authenticated;
revoke execute on function public.app_portal_url() from public, anon, authenticated;
revoke execute on function public.effective_late_fee_amount(uuid) from public, anon, authenticated;
revoke execute on function public.effective_late_fee_grace_days(uuid) from public, anon, authenticated;
revoke execute on function public.effective_nsf_fee_amount(uuid) from public, anon, authenticated;
