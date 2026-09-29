-- Vendor document requests (W-9, insurance certificates, licenses) that
-- vendors answer through an emailed, single-purpose upload link — no portal
-- login needed — followed by staff review.
--
-- Also: vendors could previously UPDATE/DELETE their own document_requests
-- (FOR ALL policy), including marking them approved. They can now only read
-- them; uploads go through service-role functions.

drop policy if exists doc_requests_vendor_self on public.document_requests;
create policy doc_requests_vendor_self on public.document_requests for select to authenticated
  using (vendor_id = public.current_vendor_id());

alter table public.document_requests
  add column if not exists review_note text check (review_note is null or length(review_note) <= 1000);

-- Upload links: only a SHA-256 of the token is stored; service role only.
create table if not exists public.document_request_links (
  request_id uuid primary key references public.document_requests(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  sent_to text,
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.document_request_links enable row level security;
revoke all on public.document_request_links from public, anon, authenticated;
grant all on public.document_request_links to service_role;

create or replace function public.vendor_expiration_column(p_doc_type text)
returns text language sql immutable set search_path = pg_catalog, public as $$
  select case p_doc_type
    when 'general_liability' then 'general_liability_expiration'
    when 'workers_comp' then 'workers_comp_expiration'
    when 'auto_insurance' then 'auto_insurance_expiration'
    when 'state_license' then 'state_license_expiration'
    when 'epa_certification' then 'epa_certification_expiration'
    when 'contract' then 'contract_expiration'
  end;
$$;

-- Token session for the public upload page (service role only).
create or replace function public.vendor_request_session(p_token_hash text)
returns jsonb
language sql stable security definer set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'request_id', r.id, 'vendor_id', r.vendor_id, 'vendor_name', v.name, 'doc_type', r.doc_type,
    'name', r.name, 'description', r.description, 'status', r.status, 'due_date', r.due_date,
    'review_note', r.review_note, 'company_name', p.company_name, 'portfolio_id', r.portfolio_id,
    'requested_by', r.requested_by)
    from public.document_request_links l
    join public.document_requests r on r.id = l.request_id
    join public.vendors v on v.id = r.vendor_id and v.archived_at is null
    join public.portfolios p on p.id = r.portfolio_id
   where l.token_hash = p_token_hash and l.expires_at > now();
$$;

-- Record an upload made through the link (service role only).
create or replace function public.submit_vendor_request_upload(
  p_token_hash text, p_path text, p_file_name text, p_expires_on date)
returns uuid
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare r record; v_doc uuid;
begin
  select req.* into r
    from public.document_request_links l join public.document_requests req on req.id = l.request_id
   where l.token_hash = p_token_hash and l.expires_at > now()
   for update of req;
  if not found then raise exception 'This upload link is not valid' using errcode = 'P0002'; end if;
  if r.status::text not in ('requested', 'in_progress', 'rejected') then
    raise exception 'This request has already been answered' using errcode = '55000';
  end if;
  if p_path is null or p_path not like 'vendors/' || r.vendor_id::text || '/compliance/%' or p_path ~ '\.\.' then
    raise exception 'Invalid document reference' using errcode = '22023';
  end if;
  if p_expires_on is not null and (p_expires_on < current_date - 1 or p_expires_on > current_date + 3660) then
    raise exception 'Enter the expiration date shown on the document' using errcode = '22023';
  end if;
  insert into public.documents (entity_type, entity_id, doc_type, file_name, file_url, expires_at)
  values ('vendor', r.vendor_id,
          case when r.doc_type in ('workers_comp', 'general_liability', 'auto_insurance', 'epa_certification', 'state_license', 'contract', 'w9') then r.doc_type else 'other' end,
          left(coalesce(nullif(btrim(p_file_name), ''), 'document'), 200), p_path,
          case when p_expires_on is not null then p_expires_on::timestamptz end)
  returning id into v_doc;
  update public.document_requests
     set status = 'submitted', submitted_at = now(), updated_at = now(),
         attachment_urls = coalesce(attachment_urls, '[]'::jsonb) || to_jsonb(p_path)
   where id = r.id;
  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, changes)
  values (r.portfolio_id, 'vendor', r.vendor_id, 'vendor_document_submitted',
          jsonb_build_object('request_id', r.id, 'document_id', v_doc, 'doc_type', r.doc_type, 'expires_on', p_expires_on, 'via', 'upload_link'));
  return v_doc;
end $$;

-- Staff review. Approving an insurance/license document updates the vendor's
-- expiration date so compliance checks and work-order assignment see it.
create or replace function public.review_vendor_document_request(
  p_request_id uuid, p_approve boolean, p_note text, p_expires_on date)
returns void
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare r record; v_col text; v_path text;
begin
  select * into r from public.document_requests where id = p_request_id and vendor_id is not null for update;
  if not found or not public.can_access_portfolio(r.portfolio_id) then
    raise exception 'Request not found' using errcode = 'P0002';
  end if;
  if r.status::text <> 'submitted' then
    raise exception 'Only submitted documents can be reviewed' using errcode = '55000';
  end if;
  if not p_approve and length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'Tell the vendor what is wrong so they can fix it' using errcode = '22023';
  end if;
  v_col := public.vendor_expiration_column(r.doc_type);
  if p_approve and v_col is not null and p_expires_on is null then
    raise exception 'Enter the expiration date from the document' using errcode = '22023';
  end if;

  update public.document_requests
     set status = case when p_approve then 'approved' else 'rejected' end::public.document_request_status,
         reviewed_at = now(), reviewed_by = auth.uid(), review_note = nullif(btrim(p_note), ''), updated_at = now()
   where id = r.id;

  if p_approve and v_col is not null then
    execute format('update public.vendors set %I = $1, updated_at = now() where id = $2', v_col) using p_expires_on, r.vendor_id;
    v_path := r.attachment_urls ->> (jsonb_array_length(r.attachment_urls) - 1);
    if v_path is not null then
      update public.documents set expires_at = p_expires_on::timestamptz
       where entity_type = 'vendor' and entity_id = r.vendor_id and file_url = v_path;
    end if;
  end if;

  insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
  values (r.portfolio_id, 'vendor', r.vendor_id, case when p_approve then 'vendor_document_approved' else 'vendor_document_rejected' end,
          auth.uid(), (select email from auth.users where id = auth.uid()),
          jsonb_build_object('request_id', r.id, 'doc_type', r.doc_type, 'expires_on', p_expires_on, 'note', p_note));
end $$;

alter function public.vendor_request_session(text) owner to postgres;
alter function public.submit_vendor_request_upload(text, text, text, date) owner to postgres;
alter function public.review_vendor_document_request(uuid, boolean, text, date) owner to postgres;
revoke all on function public.vendor_request_session(text) from public, anon, authenticated;
revoke all on function public.submit_vendor_request_upload(text, text, text, date) from public, anon, authenticated;
revoke all on function public.review_vendor_document_request(uuid, boolean, text, date) from public, anon;
revoke all on function public.vendor_expiration_column(text) from public, anon;
grant execute on function public.vendor_request_session(text) to service_role;
grant execute on function public.submit_vendor_request_upload(text, text, text, date) to service_role;
grant execute on function public.review_vendor_document_request(uuid, boolean, text, date) to authenticated, service_role;
grant execute on function public.vendor_expiration_column(text) to authenticated, service_role;
