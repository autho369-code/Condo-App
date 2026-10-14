-- Architectural reviews, documents and e-signatures (audit fixes).
--
-- 1. ARC records are final once decided:
--    a. Discussion messages can't be edited or deleted through the API (staff
--       could rewrite or remove a homeowner's message): UPDATE and DELETE are
--       revoked from signed-in users, so the staff policy only reads and adds.
--    b. arch_msg_set_author() stamps every message a signed-in user adds:
--       staff of the request's association post as 'staff' under their own
--       id and profile name; the request's owner posts as 'owner'. It is now
--       SECURITY INVOKER so it can tell a direct API insert (current_user =
--       authenticated) from a trusted definer function.
--    c. A request that is approved, denied or withdrawn can't be changed
--       (status, decision, notes, attachments) except by a repair session
--       (app_is_repair_session(): service role or a direct database session).
--       The decision itself is the open -> decided update, which passes.
--    d. Denying a request needs a reason (decision_notes), in the database.
--    e. Attachment lists change in one locked statement
--       (arc_append_attachment / arc_remove_attachment, service role only),
--       so two uploads at once can't drop each other's file.
-- 2. signature_session() returns the document (body text / PDF path) only
--    while the request is open and the signer isn't blocked, or once it is
--    completed for a signer who signed; never for a voided, declined or
--    expired request.
-- 4. architectural_review_settings.default_committee_id must be a committee
--    of the same association.
-- 5. documents_staff_tenant_all compared every row through
--    can_access_portfolio(document_portfolio_id(...)) (two definer calls per
--    row: ~1.5 s at 5,000 documents). It now compares entity ids with
--    once-per-query id sets per entity type (rls_private.my_document_entity_ids),
--    the same rows: an entity in the caller's company (or any company for a
--    platform operator), by the same entity types document_portfolio_id knew.
-- 6. document_requests.owner_id must be an owner of the request's company.
-- 8. owner_form_submissions: owners read their own forms by
--    current_owner_ids() (was an email match), and staff notes move to the
--    staff-only owner_form_submission_private table.
-- 10. E-signatures: a reminder (new link) can't go to a signer whose turn
--    hasn't come in a sequential request; declining checks expiry; a scoped
--    manager can only link a request to a record of an association they
--    manage.
--
-- Re-runnable: function patches check their marker first; every anchor must
-- appear exactly once. No table or column is dropped.

-- ── Patch helper ──────────────────────────────────────────────────────────
create or replace function pg_temp.patch_fn(p_sig text, p_marker text, p_pairs text[])
returns void
language plpgsql
as $function$
declare
  v_def text := replace(pg_get_functiondef(p_sig::regprocedure), E'\r\n', E'\n');
  i integer;
begin
  if position(p_marker in v_def) > 0 then return; end if;
  for i in 1 .. array_length(p_pairs, 1) / 2 loop
    if array_length(string_to_array(v_def, p_pairs[2 * i - 1]), 1) <> 2 then
      raise exception '% : anchor not found exactly once: %', p_sig, p_pairs[2 * i - 1];
    end if;
    v_def := replace(v_def, p_pairs[2 * i - 1], p_pairs[2 * i]);
  end loop;
  if position(p_marker in v_def) = 0 then raise exception '% : marker missing after patch', p_sig; end if;
  execute v_def;
end
$function$;

-- ── 1a. Messages are a record ────────────────────────────────────────────
revoke update, delete on public.architectural_request_messages from authenticated, anon;

-- ── 1b. Message author ────────────────────────────────────────────────────
create or replace function public.arch_msg_set_author()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_assoc uuid;
  v_owner uuid;
  v_is_owner boolean;
  v_is_staff boolean;
  v_name text;
begin
  -- arc_msg_author_v2: a trusted definer function (or the service role)
  -- writes as itself; only direct inserts by signed-in users are stamped.
  if current_user not in ('authenticated', 'anon') or auth.uid() is null then
    return new;
  end if;
  select r.association_id, r.owner_id into v_assoc, v_owner
    from public.architectural_requests r where r.id = new.request_id;
  v_is_owner := v_owner is not null and v_owner in (select public.current_owner_ids());
  v_is_staff := v_assoc is not null
    and (public.is_platform_operator() or public.is_any_staff() or public.is_company_admin())
    and coalesce(public.can_access_association(v_assoc), false);
  select nullif(btrim(p.full_name), '') into v_name from public.profiles p where p.id = auth.uid();
  new.author_id := auth.uid();
  if v_is_owner and (new.author_role = 'owner' or not v_is_staff) then
    -- The homeowner on their own request (a staff member who owns this unit
    -- and posts from the owner portal stays the homeowner).
    new.author_role := 'owner';
    new.author_name := coalesce(v_name, 'Owner');
  elsif v_is_staff then
    new.author_role := 'staff';
    new.author_name := coalesce(v_name, 'Staff');
  else
    -- Neither: the insert policies refuse it; never keep a claimed name.
    new.author_role := 'owner';
    new.author_name := coalesce(v_name, 'Owner');
  end if;
  return new;
end
$function$;

revoke all on function public.arch_msg_set_author() from public, anon, authenticated;

-- ── 1c/1d. Decided requests are final; a denial needs a reason ────────────
create or replace function public.architectural_requests_final_guard()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if public.app_is_repair_session() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('approved', 'denied', 'withdrawn') then
    raise exception 'This request is already %; it can no longer be changed', old.status
      using errcode = '55000';
  end if;
  if new.status = 'denied'
     and (tg_op = 'INSERT' or old.status is distinct from 'denied')
     and nullif(btrim(coalesce(new.decision_notes, '')), '') is null then
    raise exception 'Give the homeowner a reason when denying a request' using errcode = '23514';
  end if;
  return new;
end
$function$;

revoke all on function public.architectural_requests_final_guard() from public, anon, authenticated;

-- Runs after the owner guard (trigger names fire in order).
create or replace trigger trg_architectural_requests_001_final_guard
  before insert or update on public.architectural_requests
  for each row execute function public.architectural_requests_final_guard();

-- ── 1e. Attachment lists change atomically ───────────────────────────────
create or replace function public.arc_append_attachment(
  p_request_id uuid, p_association_id uuid, p_attachment jsonb, p_max integer)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v public.architectural_requests;
  v_list jsonb;
begin
  select * into v from public.architectural_requests
   where id = p_request_id and association_id = p_association_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if v.status not in ('submitted', 'under_review', 'more_info') then
    raise exception 'Documents can only be added while the request is open' using errcode = '55000';
  end if;
  v_list := case when jsonb_typeof(v.attachments) = 'array' then v.attachments else '[]'::jsonb end;
  if exists (select 1 from jsonb_array_elements(v_list) e where e ->> 'path' = p_attachment ->> 'path') then
    return 'exists';
  end if;
  if jsonb_array_length(v_list) >= p_max then
    raise exception 'Limit of % documents reached', p_max using errcode = '54000';
  end if;
  update public.architectural_requests
     set attachments = v_list || jsonb_build_array(p_attachment)
   where id = p_request_id;
  return 'added';
end
$function$;

create or replace function public.arc_remove_attachment(
  p_request_id uuid, p_association_id uuid, p_path text, p_require_open boolean)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v public.architectural_requests;
  v_list jsonb;
begin
  select * into v from public.architectural_requests
   where id = p_request_id and association_id = p_association_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if p_require_open and v.status not in ('submitted', 'under_review', 'more_info') then
    raise exception 'Documents can no longer be changed on a decided request' using errcode = '55000';
  end if;
  v_list := case when jsonb_typeof(v.attachments) = 'array' then v.attachments else '[]'::jsonb end;
  if not exists (select 1 from jsonb_array_elements(v_list) e where e ->> 'path' = p_path) then
    return false;
  end if;
  update public.architectural_requests
     set attachments = (select coalesce(jsonb_agg(e order by o), '[]'::jsonb)
                          from jsonb_array_elements(v_list) with ordinality t(e, o)
                         where e ->> 'path' is distinct from p_path)
   where id = p_request_id;
  return true;
end
$function$;

-- Called by the server (service client) after it has checked the caller.
revoke all on function public.arc_append_attachment(uuid, uuid, jsonb, integer) from public, anon, authenticated;
revoke all on function public.arc_remove_attachment(uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.arc_append_attachment(uuid, uuid, jsonb, integer) to service_role;
grant execute on function public.arc_remove_attachment(uuid, uuid, text, boolean) to service_role;

-- ── 2. The document only while it may be read ─────────────────────────────
select pg_temp.patch_fn('public.signature_session(text, text, text)', 'v_show_document', array[
  'declare sg public.signature_signers; r public.signature_requests; v_blocked text;',
  'declare sg public.signature_signers; r public.signature_requests; v_blocked text; v_show_document boolean;',
  '  return jsonb_build_object(',
  '  -- Open and not blocked, or completed for a signer who signed.
  v_show_document := (r.status = ''sent'' and v_blocked is null)
                     or (r.status = ''completed'' and sg.status = ''signed'');
  return jsonb_build_object(',
  '''document_path'', r.document_path, ''body_text'', r.body_text,',
  '''document_path'', case when v_show_document then r.document_path end,
      ''body_text'', case when v_show_document then r.body_text end,'
]);

-- ── 4. Default committee of the same association ─────────────────────────
create or replace function public.architectural_review_settings_committee_check()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.default_committee_id is not null then
    perform 1 from public.committees c
     where c.id = new.default_committee_id and c.association_id = new.association_id
       for share;
    if not found then
      raise exception 'Choose a committee of this association' using errcode = '23514';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.architectural_review_settings_committee_check() from public, anon, authenticated;

create or replace trigger architectural_review_settings_committee_check
  before insert or update of default_committee_id, association_id on public.architectural_review_settings
  for each row execute function public.architectural_review_settings_committee_check();

-- ── 5. Documents: once-per-query id sets ─────────────────────────────────
create or replace function rls_private.my_document_entity_ids(p_entity_type text)
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_op boolean := coalesce(public.is_platform_operator(), false);
  v_pf uuid := public.my_access_portfolio();
begin
  -- Ids of the records of one documents.entity_type whose company
  -- can_access_portfolio() lets the caller reach (document_portfolio_id twin;
  -- 'general' returns profile ids, matched with coalesce(uploaded_by, me)).
  -- Change together with public.document_portfolio_id.
  if not v_op and v_pf is null then
    return;
  end if;
  if p_entity_type = 'association' then
    return query select a.id from public.associations a
      where case when v_op then a.portfolio_id is not null else a.portfolio_id = v_pf end;
  elsif p_entity_type = 'owner' then
    return query select o.id from public.owners o
      where case when v_op then o.portfolio_id is not null else o.portfolio_id = v_pf end;
  elsif p_entity_type = 'vendor' then
    return query select v.id from public.vendors v
      where case when v_op then v.portfolio_id is not null else v.portfolio_id = v_pf end;
  elsif p_entity_type = 'unit' then
    return query select u.id from public.units u
      join public.buildings b on b.id = u.building_id
      join public.associations a on a.id = b.association_id
      where case when v_op then a.portfolio_id is not null else a.portfolio_id = v_pf end;
  elsif p_entity_type = 'general' then
    return query select p.id from public.profiles p
      where case when v_op then p.portfolio_id is not null else p.portfolio_id = v_pf end;
  end if;
end
$function$;

revoke all on function rls_private.my_document_entity_ids(text) from public, anon;
grant execute on function rls_private.my_document_entity_ids(text) to authenticated, service_role;

alter policy documents_staff_tenant_all on public.documents
  using (
    ((select auth.uid()) is not null)
    and ((select public.is_any_staff()) or (select public.is_company_admin()))
    and public.document_path_matches_entity(entity_type, entity_id, file_url)
    and case lower(btrim(entity_type))
      when 'association' then coalesce(entity_id in (select rls_private.my_document_entity_ids('association')), false)
      when 'owner' then coalesce(entity_id in (select rls_private.my_document_entity_ids('owner')), false)
      when 'vendor' then coalesce(entity_id in (select rls_private.my_document_entity_ids('vendor')), false)
      when 'unit' then coalesce(entity_id in (select rls_private.my_document_entity_ids('unit')), false)
      when 'general' then coalesce(coalesce(uploaded_by, (select auth.uid())) in (select rls_private.my_document_entity_ids('general')), false)
      else false
    end
  )
  with check (
    ((select auth.uid()) is not null)
    and ((select public.is_any_staff()) or (select public.is_company_admin()))
    and ((uploaded_by is null) or (uploaded_by = (select auth.uid())))
    and public.document_path_matches_entity(entity_type, entity_id, file_url)
    and case lower(btrim(entity_type))
      when 'association' then coalesce(entity_id in (select rls_private.my_document_entity_ids('association')), false)
      when 'owner' then coalesce(entity_id in (select rls_private.my_document_entity_ids('owner')), false)
      when 'vendor' then coalesce(entity_id in (select rls_private.my_document_entity_ids('vendor')), false)
      when 'unit' then coalesce(entity_id in (select rls_private.my_document_entity_ids('unit')), false)
      when 'general' then coalesce(coalesce(uploaded_by, (select auth.uid())) in (select rls_private.my_document_entity_ids('general')), false)
      else false
    end
  );

-- ── 6. A document request's owner is in the request's company ────────────
create or replace function public.document_requests_owner_company_check()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_pf uuid;
begin
  if new.owner_id is not null then
    select o.portfolio_id into v_pf from public.owners o where o.id = new.owner_id for share;
    if not found or v_pf is distinct from new.portfolio_id then
      raise exception 'That owner is not in this company' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.document_requests_owner_company_check() from public, anon, authenticated;

create or replace trigger document_requests_owner_company_check
  before insert or update of owner_id, portfolio_id on public.document_requests
  for each row execute function public.document_requests_owner_company_check();

-- ── 8. Owner form submissions ─────────────────────────────────────────────
alter policy "Owners read own forms" on public.owner_form_submissions
  using (owner_id in (select public.current_owner_ids()));

create table if not exists public.owner_form_submission_private (
  submission_id uuid primary key
    references public.owner_form_submissions(id) on delete cascade deferrable initially deferred,
  notes text,
  updated_at timestamptz not null default now()
);

alter table public.owner_form_submission_private enable row level security;
revoke all on public.owner_form_submission_private from anon;
grant select, insert, update, delete on public.owner_form_submission_private to authenticated;

-- Staff of the owner's company (scoped managers: their associations).
create or replace function rls_private.staff_owner_form_submission_ids()
returns setof uuid
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_op boolean := coalesce(public.is_platform_operator(), false);
  v_pf uuid := public.my_access_portfolio();
  v_scoped boolean := coalesce(public.manager_is_scoped(), false);
begin
  if v_op then
    return query select s.id from public.owner_form_submissions s
      join public.owners o on o.id = s.owner_id where o.portfolio_id is not null;
  elsif v_pf is not null then
    return query select s.id from public.owner_form_submissions s
      join public.owners o on o.id = s.owner_id
     where o.portfolio_id = v_pf
       and (not v_scoped or o.association_id in (select public.my_managed_association_ids()));
  end if;
end
$function$;

revoke all on function rls_private.staff_owner_form_submission_ids() from public, anon;
grant execute on function rls_private.staff_owner_form_submission_ids() to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'owner_form_submission_private' and policyname = 'owner_form_submission_private_staff') then
    create policy owner_form_submission_private_staff on public.owner_form_submission_private
      for all to authenticated
      using (submission_id in (select rls_private.staff_owner_form_submission_ids()))
      with check (submission_id in (select rls_private.staff_owner_form_submission_ids()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'owner_form_submission_private' and policyname = 'mgr_assoc_scope') then
    create policy mgr_assoc_scope on public.owner_form_submission_private
      as restrictive for all to authenticated
      using (((select public.manager_is_scoped()) is not true)
             or submission_id in (select rls_private.staff_owner_form_submission_ids()));
  end if;
end
$$;

-- Notes written on the submission row land in the private table.
create or replace function public.move_owner_form_submission_notes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.notes is not null then
    if not public.is_self_service_caller() then
      insert into public.owner_form_submission_private (submission_id, notes, updated_at)
      values (new.id, nullif(btrim(new.notes), ''), now())
      on conflict (submission_id) do update set notes = excluded.notes, updated_at = now();
    end if;
    new.notes := null;
  end if;
  return new;
end
$function$;

revoke all on function public.move_owner_form_submission_notes() from public, anon, authenticated;

create or replace trigger owner_form_submissions_move_notes
  before insert or update of notes on public.owner_form_submissions
  for each row execute function public.move_owner_form_submission_notes();

insert into public.owner_form_submission_private (submission_id, notes, updated_at)
select s.id, nullif(btrim(s.notes), ''), now() from public.owner_form_submissions s where s.notes is not null
on conflict (submission_id) do update set notes = excluded.notes, updated_at = now();
update public.owner_form_submissions set notes = null where notes is not null;

-- ── 10. E-signatures ──────────────────────────────────────────────────────
select pg_temp.patch_fn('public.rotate_signature_signer_token(uuid, text)', 'turn has not come yet', array[
  '  if p_token_hash !~ ''^[0-9a-f]{64}$'' then',
  '  if r.sequential and exists (
    select 1 from public.signature_signers o
     where o.request_id = r.id and o.sign_order < sg.sign_order and o.status <> ''signed''
  ) then raise exception ''This signer''''s turn has not come yet; they are emailed when the signer before them signs'' using errcode = ''22023''; end if;
  if p_token_hash !~ ''^[0-9a-f]{64}$'' then'
]);

select pg_temp.patch_fn('public.decline_signature_request(text, text, text, text)', 'This request has expired', array[
  '  if r.status <> ''sent'' then raise exception ''This request is no longer open''; end if;',
  '  if r.status <> ''sent'' then raise exception ''This request is no longer open''; end if;
  if r.expires_at < now() then raise exception ''This request has expired''; end if;'
]);

select pg_temp.patch_fn(
  'public.create_signature_request(uuid, uuid, text, uuid, text, text, text, text, text, text, jsonb, integer, boolean)',
  'v_subject_association', array[
  'declare v_id uuid; s jsonb; n integer := 0; v_subject_portfolio uuid;',
  'declare v_id uuid; s jsonb; n integer := 0; v_subject_portfolio uuid; v_subject_association uuid;',
  '      raise exception ''Linked record is outside your portfolio'' using errcode = ''42501'';
    end if;',
  '      raise exception ''Linked record is outside your portfolio'' using errcode = ''42501'';
    end if;
    -- A manager assigned to some associations links only their records.
    if coalesce(public.manager_is_scoped(), false) then
      v_subject_association := case p_subject_type
        when ''architectural_request'' then (select association_id from public.architectural_requests where id = p_subject_id)
        when ''management_agreement'' then (select association_id from public.management_agreements where id = p_subject_id)
        when ''year_end_package'' then (select association_id from public.year_end_packages where id = p_subject_id)
        else null end;
      if v_subject_association is null
         or v_subject_association not in (select public.my_managed_association_ids()) then
        raise exception ''Linked record is outside the associations you manage'' using errcode = ''42501'';
      end if;
    end if;'
]);
