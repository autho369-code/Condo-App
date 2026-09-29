-- Board reports: which statements each association's board receives, and
-- monthly publication of that package to the board portal.
--
-- Published packages are ordinary association documents
-- (doc_type 'board_report', folder 'Board reports', share_scope board or
-- owners), so the sharing rules from association_document_folders_sharing
-- govern who can open them.

alter table public.documents drop constraint if exists documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check check (doc_type = any (array[
  'lease', 'ho6', 'renters_insurance', 'bylaws', 'minutes', 'other', 'workers_comp', 'general_liability',
  'auto_insurance', 'epa_certification', 'state_license', 'contract', 'w9', 'vendor_invoice', 'declaration_ccrs',
  'articles_of_incorporation', 'rules_regulations', 'operating_budget', 'master_insurance_policy',
  'association_document', 'board_report'
]));

create table if not exists public.association_board_report_settings (
  association_id uuid primary key references public.associations(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  sections text[] not null default array['balance_sheet', 'income_statement', 'budget_vs_actual', 'ar_aging', 'delinquency_summary', 'bank_reconciliation'],
  share_scope text not null default 'board' check (share_scope in ('board', 'owners')),
  auto_publish boolean not null default false,
  publish_day integer not null default 10 check (publish_day between 1 and 28),
  notify_board boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint board_report_sections_valid check (
    cardinality(sections) between 1 and 8
    and sections <@ array['trial_balance', 'balance_sheet', 'income_statement', 'budget_vs_actual', 'ar_aging',
                          'delinquency_summary', 'ap_aging', 'bank_reconciliation']
  )
);
alter table public.association_board_report_settings enable row level security;
drop policy if exists board_report_settings_staff_read on public.association_board_report_settings;
create policy board_report_settings_staff_read on public.association_board_report_settings for select to authenticated
  using (public.can_manage_association(association_id));
drop policy if exists board_report_settings_board_read on public.association_board_report_settings;
create policy board_report_settings_board_read on public.association_board_report_settings for select to authenticated
  using (public.is_board_user() and association_id in (select public.current_board_association_ids()));
revoke all on public.association_board_report_settings from anon;
grant select on public.association_board_report_settings to authenticated;

create or replace function public.save_board_report_settings(
  p_association_id uuid, p_sections text[], p_share_scope text, p_auto_publish boolean, p_publish_day integer, p_notify_board boolean)
returns void
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_portfolio uuid; v_before jsonb;
begin
  if not public.can_manage_association(p_association_id) then
    raise exception 'Not authorized for this association' using errcode = '42501';
  end if;
  if p_sections is null or cardinality(p_sections) = 0 then
    raise exception 'Choose at least one report for the board package' using errcode = '22023';
  end if;
  select portfolio_id into v_portfolio from public.associations where id = p_association_id;
  select to_jsonb(s) into v_before from public.association_board_report_settings s where association_id = p_association_id;
  insert into public.association_board_report_settings as s
    (association_id, portfolio_id, sections, share_scope, auto_publish, publish_day, notify_board, updated_at, updated_by)
  values (p_association_id, v_portfolio, (select array_agg(distinct x order by x) from unnest(p_sections) x),
          coalesce(p_share_scope, 'board'), coalesce(p_auto_publish, false), coalesce(p_publish_day, 10), coalesce(p_notify_board, true), now(), auth.uid())
  on conflict (association_id) do update set
    sections = excluded.sections, share_scope = excluded.share_scope, auto_publish = excluded.auto_publish,
    publish_day = excluded.publish_day, notify_board = excluded.notify_board, updated_at = now(), updated_by = auth.uid();
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (v_portfolio, 'association', p_association_id, 'board_report_settings_updated', auth.uid(),
          (select email from auth.users where id = auth.uid()),
          jsonb_build_object('before', v_before, 'after', (select to_jsonb(s) from public.association_board_report_settings s where association_id = p_association_id)));
exception
  when check_violation then raise exception 'Choose valid reports and a publish day between 1 and 28' using errcode = '22023';
end $$;

alter function public.save_board_report_settings(uuid, text[], text, boolean, integer, boolean) owner to postgres;
revoke all on function public.save_board_report_settings(uuid, text[], text, boolean, integer, boolean) from public, anon;
grant execute on function public.save_board_report_settings(uuid, text[], text, boolean, integer, boolean) to authenticated, service_role;
