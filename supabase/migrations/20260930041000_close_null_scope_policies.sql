-- SECURITY: several policies used "association_id IS NULL OR can_access_association(...)".
-- For rows with no association that let ANY caller through — including anon,
-- because these policies were granted to PUBLIC and the restrictive
-- mgr_assoc_scope policy only applies to `authenticated`.
--   * automation_tasks / calendar_event_reminders / communication_messages:
--     anon could read, insert, update and delete association-less rows
--     (communication_messages drives outbound email/SMS).
--   * board read on calendar_events / fixed_assets / gl_accounts: a board
--     member could read every company's association-less rows (294
--     company-level GL accounts across all tenants).
--   * shares: every unexpired share snapshot was world-readable and
--     enumerable. The table is unused by the app (0 rows); lookups must go
--     through a token-checked function if it is ever used.
-- Association-less rows are now scoped to the caller's portfolio.

do $$
declare t text;
begin
  foreach t in array array['automation_tasks', 'calendar_event_reminders', 'communication_messages'] loop
    execute format('drop policy if exists %I on public.%I',
      case t when 'automation_tasks' then 'staff can manage automation tasks'
             when 'calendar_event_reminders' then 'staff can manage calendar reminders'
             else 'staff can manage communication messages' end, t);
    execute format('drop policy if exists %I on public.%I',
      case t when 'automation_tasks' then 'staff can read automation tasks'
             when 'calendar_event_reminders' then 'staff can read calendar reminders'
             else 'staff can read communication messages' end, t);
    execute format($p$
      create policy %I on public.%I for all to authenticated
        using (public.is_platform_operator()
               or (association_id is not null and public.can_access_association(association_id))
               or (association_id is null and portfolio_id is not null and public.can_access_portfolio(portfolio_id)))
        with check (public.is_platform_operator()
               or (association_id is not null and public.can_access_association(association_id))
               or (association_id is null and portfolio_id is not null and public.can_access_portfolio(portfolio_id)))
    $p$, t || '_staff_scoped', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

drop policy if exists calendar_events_board_read on public.calendar_events;
create policy calendar_events_board_read on public.calendar_events for select to authenticated
  using (public.is_board_user() and (
    association_id in (select public.current_board_association_ids())
    or (association_id is null and portfolio_id = public.current_portfolio_id())));

drop policy if exists fixed_assets_board_read on public.fixed_assets;
create policy fixed_assets_board_read on public.fixed_assets for select to authenticated
  using (public.is_board_user() and (
    association_id in (select public.current_board_association_ids())
    or (association_id is null and portfolio_id = public.current_portfolio_id())));

drop policy if exists gl_accounts_board_read on public.gl_accounts;
create policy gl_accounts_board_read on public.gl_accounts for select to authenticated
  using (public.is_board_user() and (
    association_id in (select public.current_board_association_ids())
    or (association_id is null and portfolio_id = public.current_portfolio_id())));

drop policy if exists shares_public_read on public.shares;
revoke all on public.shares from anon;
