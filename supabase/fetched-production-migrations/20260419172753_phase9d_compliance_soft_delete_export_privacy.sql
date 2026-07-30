-- =============================================================================
-- Phase 9d — Compliance
--   • soft_delete_log (captures archived_at flips with full prior state)
--   • data_export_requests (GDPR / CCPA portability)
--   • privacy_actions (right-to-be-forgotten workflow)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. soft_delete_log
-- -----------------------------------------------------------------------------
create table public.soft_delete_log (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  archived_by uuid references auth.users(id) on delete set null,
  reason text,
  prior_state jsonb not null,
  archived_at timestamptz not null default now()
);
create index idx_soft_delete_entity on public.soft_delete_log(entity_type, entity_id);
create index idx_soft_delete_portfolio on public.soft_delete_log(portfolio_id, archived_at desc);
create index idx_soft_delete_actor on public.soft_delete_log(archived_by, archived_at desc);

alter table public.soft_delete_log enable row level security;
create policy soft_delete_log_platform_all on public.soft_delete_log
  for select to authenticated using (public.is_platform_operator());
create policy soft_delete_log_admin_read on public.soft_delete_log
  for select to authenticated
  using (public.is_full_access_staff() and portfolio_id = public.current_portfolio_id());

comment on table public.soft_delete_log is 'Captures every archived_at flip. Enables undo and forensic analysis. Portfolio admins see their own portfolio only.';

-- -----------------------------------------------------------------------------
-- 2. Generic soft-delete trigger (reusable)
--    Attach to any table with archived_at + portfolio_id (direct or via joins).
--    For now we attach to the high-value tables.
-- -----------------------------------------------------------------------------
create or replace function public.log_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  resolved_portfolio_id uuid;
begin
  if new.archived_at is not null and (old.archived_at is null or old.archived_at is distinct from new.archived_at) then
    -- Try to pick the portfolio_id off the row directly; otherwise leave null
    begin
      execute format('select ($1::%I).portfolio_id', tg_relid::regclass::text)
        into resolved_portfolio_id using new;
    exception when others then
      resolved_portfolio_id := null;
    end;

    insert into public.soft_delete_log (
      portfolio_id, entity_type, entity_id, archived_by, prior_state
    ) values (
      resolved_portfolio_id,
      tg_table_name,
      (row_to_json(new)->>'id')::uuid,
      auth.uid(),
      to_jsonb(old)
    );
  end if;
  return new;
end;
$$;

-- Attach to the most sensitive archival points
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'vendors','associations','buildings','units','owners','portfolios',
    'payable_bills','purchase_orders','recurring_work_orders',
    'calendar_events','inspections','fixed_assets','work_orders',
    'violations','notices','committees','document_templates','form_templates',
    'management_fee_schedules','bank_accounts','tenancies',
    'approval_requests','surveys','user_invitations','api_keys'
  ]
  loop
    if exists (select 1 from information_schema.columns
                where table_schema = 'public' and table_name = tbl and column_name = 'archived_at') then
      execute format('drop trigger if exists trg_log_soft_delete on public.%I', tbl);
      execute format(
        'create trigger trg_log_soft_delete
           after update of archived_at on public.%I
           for each row when (new.archived_at is not null and old.archived_at is null)
           execute function public.log_soft_delete()',
        tbl
      );
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. data_export_requests (GDPR / CCPA portability)
-- -----------------------------------------------------------------------------
create type public.export_status as enum ('pending', 'running', 'ready', 'failed', 'expired');
create type public.export_scope as enum ('portfolio_full', 'portfolio_finance', 'user_data');

create table public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  subject_auth_user_id uuid references auth.users(id) on delete set null,
  scope public.export_scope not null default 'portfolio_full',
  requested_by uuid references auth.users(id) on delete set null,
  status public.export_status not null default 'pending',
  format text not null default 'json' check (format in ('json','csv','zip')),
  file_url text,
  file_size_bytes bigint,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz default (now() + interval '7 days'),
  download_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_data_exports_portfolio on public.data_export_requests(portfolio_id, created_at desc);
create index idx_data_exports_subject on public.data_export_requests(subject_auth_user_id, created_at desc);
create index idx_data_exports_status on public.data_export_requests(status) where status in ('pending','running');
create trigger trg_data_exports_updated before update on public.data_export_requests
  for each row execute function public.touch_updated_at();

alter table public.data_export_requests enable row level security;
create policy data_exports_platform_all on public.data_export_requests
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy data_exports_admin_portfolio on public.data_export_requests
  for all to authenticated
  using (public.can_admin_portfolio(portfolio_id) and public.has_entitlement(portfolio_id, 'data_export'))
  with check (public.can_admin_portfolio(portfolio_id) and public.has_entitlement(portfolio_id, 'data_export'));
create policy data_exports_subject_read on public.data_export_requests
  for select to authenticated using (subject_auth_user_id = auth.uid());

comment on table public.data_export_requests is 'Async data export jobs. Portfolio admins request via admin panel (requires data_export entitlement). Expired exports are purged by cron.';

-- -----------------------------------------------------------------------------
-- 4. privacy_actions (right-to-be-forgotten)
-- -----------------------------------------------------------------------------
create type public.privacy_action_type as enum (
  'data_export', 'data_deletion', 'anonymization', 'access_report', 'consent_withdrawal'
);
create type public.privacy_action_status as enum (
  'received', 'verified', 'in_progress', 'completed', 'rejected', 'partially_completed'
);

create table public.privacy_actions (
  id uuid primary key default gen_random_uuid(),
  subject_email text not null,
  subject_auth_user_id uuid references auth.users(id) on delete set null,
  subject_owner_id uuid references public.owners(id) on delete set null,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  action_type public.privacy_action_type not null,
  status public.privacy_action_status not null default 'received',
  jurisdiction text check (jurisdiction in ('gdpr','ccpa','other') or jurisdiction is null),
  requested_at timestamptz not null default now(),
  deadline timestamptz not null default (now() + interval '30 days'),
  verified_at timestamptz,
  completed_at timestamptz,
  rejected_at timestamptz,
  rejection_reason text,
  handler_user_id uuid references auth.users(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  evidence_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_privacy_actions_subject on public.privacy_actions(lower(subject_email), created_at desc);
create index idx_privacy_actions_portfolio on public.privacy_actions(portfolio_id, created_at desc);
create index idx_privacy_actions_deadline on public.privacy_actions(deadline) where status not in ('completed','rejected');
create index idx_privacy_actions_type on public.privacy_actions(action_type, status);
create trigger trg_privacy_actions_updated before update on public.privacy_actions
  for each row execute function public.touch_updated_at();

alter table public.privacy_actions enable row level security;
create policy privacy_actions_platform_all on public.privacy_actions
  for all to authenticated using (public.is_platform_operator()) with check (public.is_platform_operator());
create policy privacy_actions_admin_portfolio on public.privacy_actions
  for all to authenticated
  using (public.can_admin_portfolio(portfolio_id))
  with check (public.can_admin_portfolio(portfolio_id));
create policy privacy_actions_subject_read on public.privacy_actions
  for select to authenticated using (subject_auth_user_id = auth.uid());

comment on table public.privacy_actions is 'GDPR / CCPA privacy request tracking. 30-day deadline default. Completion writes to the permission_audit_log via a separate trigger path on implementing code.';

-- -----------------------------------------------------------------------------
-- 5. Anonymization helper (for right-to-be-forgotten without breaking FKs)
--    Scrubs PII but keeps the row so statements/payments stay historically valid.
-- -----------------------------------------------------------------------------
create or replace function public.anonymize_owner(p_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  update public.owners
     set full_name = 'Anonymized (' || left(id::text, 8) || ')',
         first_name = null, last_name = null,
         email = id::text || '@anonymized.local',
         phone = null,
         phone_numbers = '[]'::jsonb,
         emails = '[]'::jsonb,
         mailing_address = null,
         address_street = null, address_city = null, address_state = null, address_zip = null,
         notes = null,
         portal_activated = false,
         portal_login_last_at = null,
         auth_user_id = null,
         archived_at = coalesce(archived_at, now()),
         updated_at = now()
   where id = p_owner_id;
end;
$$;

grant execute on function public.anonymize_owner(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- 6. Purge expired exports (nightly)
-- -----------------------------------------------------------------------------
select cron.schedule(
  'expire-old-data-exports',
  '5 4 * * *',
  $$ update public.data_export_requests
        set status = 'expired', updated_at = now(), file_url = null
      where status = 'ready'
        and expires_at < now(); $$
);

-- -----------------------------------------------------------------------------
-- 7. Purge old audit log based on tier entitlement
--    (Max tier keeps 7 years; others 90 days)
-- -----------------------------------------------------------------------------
select cron.schedule(
  'purge-audit-log-by-tier',
  '45 4 * * *',
  $$
  delete from public.permission_audit_log pal
   where pal.at < case
     when exists (
       select 1 from public.portfolios p
        where p.id = pal.actor_portfolio_id
          and p.tier = 'max'
     ) then now() - interval '7 years'
     else now() - interval '90 days'
   end;
  $$
);

-- -----------------------------------------------------------------------------
-- 8. Final stats view for admin panel
-- -----------------------------------------------------------------------------
create view public.v_portfolio_health
  with (security_invoker = true) as
select
  p.id as portfolio_id,
  p.company_name,
  p.tier,
  p.suspended_at,
  s.status as subscription_status,
  s.seats_used,
  s.seats_included,
  (select count(*) from public.associations a where a.portfolio_id = p.id and a.archived_at is null) as association_count,
  (select count(*) from public.units u
    join public.buildings b on b.id = u.building_id
    join public.associations a on a.id = b.association_id
    where a.portfolio_id = p.id and u.archived_at is null) as unit_count,
  (select count(*) from public.user_invitations inv
    where inv.portfolio_id = p.id and inv.status = 'pending') as pending_invitations,
  (select count(*) from public.login_attempts la
    where la.portfolio_id = p.id and la.at > now() - interval '24 hours' and not la.success) as failed_logins_24h,
  (select count(*) from public.webhook_deliveries wd
    join public.webhook_endpoints we on we.id = wd.endpoint_id
    where we.portfolio_id = p.id and wd.status = 'abandoned'
      and wd.created_at > now() - interval '7 days') as abandoned_webhooks_7d
from public.portfolios p
left join public.subscriptions s on s.portfolio_id = p.id;

comment on view public.v_portfolio_health is 'One-row-per-portfolio health snapshot for the platform admin panel. Inherits RLS from underlying tables.';
;
