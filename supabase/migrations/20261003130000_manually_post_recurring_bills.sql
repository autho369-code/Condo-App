-- Payables → "Manually post bills" (AppFolio's Manually Post Bills): post
-- recurring bills now, through a chosen date, instead of waiting for the
-- nightly run. The nightly run and the manual post share one routine, so a
-- bill posted early is never posted twice (unique recurring_bill_id +
-- bill_date) and the schedule moves past it.

create or replace function public.generate_recurring_bills_through(p_portfolio_id uuid, p_through date, p_scoped boolean)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  t record;
  v_date date;
  v_guard integer;
  n integer := 0;
  v_mode text;
  v_threshold numeric;
  v_needs_board boolean;
  v_bill uuid;
begin
  for t in
    select * from public.recurring_bills
     where auto_generate and archived_at is null and next_post_date is not null
       and next_post_date <= p_through
       and (end_date is null or next_post_date <= end_date)
       and (p_portfolio_id is null or portfolio_id = p_portfolio_id)
       -- A manager limited to some associations posts only those.
       and (not p_scoped or public.can_access_association(association_id))
     for update skip locked
  loop
    begin
      v_date := t.next_post_date;
      v_guard := 0;
      v_mode := null;
      v_threshold := null;
      select s.sends_bills_to_board, s.bills_threshold into v_mode, v_threshold
        from public.board_approval_settings s where s.association_id = t.association_id;
      v_needs_board := coalesce(t.association_id is not null and (coalesce(v_mode, 'never') = 'always'
                       or (v_mode = 'over_threshold' and t.amount >= coalesce(v_threshold, 0))), false);

      while v_date <= p_through and (t.end_date is null or v_date <= t.end_date) and v_guard < 12 loop
        v_bill := null;
        insert into public.payable_bills (
          portfolio_id, vendor_id, association_id, gl_account_id, bank_account_id,
          bill_date, due_date, amount, memo, status, approval_required, approved_at,
          created_by, recurring_bill_id)
        values (
          t.portfolio_id, t.vendor_id, t.association_id, t.gl_account_id, t.bank_account_id,
          v_date, v_date + t.due_days, t.amount,
          coalesce(nullif(btrim(t.memo), ''), t.name) || ' — ' || to_char(v_date, 'Mon YYYY'),
          case when v_needs_board then 'draft' else 'approved' end::public.payable_bill_status,
          v_needs_board,
          case when v_needs_board then null else now() end,
          t.created_by, t.id)
        on conflict (recurring_bill_id, bill_date) where recurring_bill_id is not null do nothing
        returning id into v_bill;
        if v_bill is not null then
          n := n + 1;
          if not v_needs_board then perform public.ensure_payable_bill_accrual(v_bill); end if;
        end if;
        v_date := public.recurring_next_date(v_date, t.frequency::text, t.interval_count, extract(day from coalesce(t.start_date, t.next_post_date))::integer);
        v_guard := v_guard + 1;
      end loop;

      update public.recurring_bills
         set next_post_date = v_date, last_generated_at = now(), last_error = null, updated_at = now(), auto_generate = (t.end_date is null or v_date <= t.end_date)
       where id = t.id;
    exception when others then
      update public.recurring_bills set last_error = left(sqlerrm, 500), updated_at = now() where id = t.id;
    end;
  end loop;
  return n;
end $function$;
revoke all on function public.generate_recurring_bills_through(uuid, date, boolean) from public, anon, authenticated;

create or replace function public.generate_recurring_bills()
returns integer language sql security definer set search_path = pg_catalog, public as $$
  select public.generate_recurring_bills_through(null, current_date, false);
$$;
revoke all on function public.generate_recurring_bills() from public, anon, authenticated;

create or replace function public.post_recurring_bills(p_through date)
returns integer language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.current_portfolio_id();
  n integer;
begin
  if v_pid is null or not public.can_manage_finance(v_pid) then
    raise exception 'Permission denied' using errcode = '42501';
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
end $$;
revoke all on function public.post_recurring_bills(date) from public, anon;
grant execute on function public.post_recurring_bills(date) to authenticated;
