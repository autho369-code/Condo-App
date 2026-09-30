-- Tags + notes with @mentions on associations, units, homeowners and vendors.
-- `tags` / `tag_assignments` already existed (unused). Writes to assignments
-- now go through set_record_tags(), which checks the record belongs to the
-- caller's portfolio (the old ALL policy only checked the tag's portfolio, so
-- a tag could be attached to another company's record id).
-- record_notes is a timestamped notes thread; @mentioned staff get an email.

-- ---------------------------------------------------------------- resolver
create or replace function public.record_portfolio_id(p_entity_type text, p_entity_id uuid)
returns uuid language sql stable security definer set search_path = pg_catalog, public as $$
  select case p_entity_type
    when 'association' then (select a.portfolio_id from public.associations a where a.id = p_entity_id)
    when 'unit' then (select a.portfolio_id from public.units u
                        join public.buildings b on b.id = u.building_id
                        join public.associations a on a.id = b.association_id
                       where u.id = p_entity_id)
    when 'owner' then (select o.portfolio_id from public.owners o where o.id = p_entity_id)
    when 'vendor' then (select v.portfolio_id from public.vendors v where v.id = p_entity_id)
  end;
$$;

create or replace function public.record_label(p_entity_type text, p_entity_id uuid)
returns text language sql stable security definer set search_path = pg_catalog, public as $$
  select case p_entity_type
    when 'association' then (select a.name from public.associations a where a.id = p_entity_id)
    when 'unit' then (select 'Unit ' || u.unit_number || coalesce(' · ' || a.name, '') from public.units u
                        join public.buildings b on b.id = u.building_id
                        join public.associations a on a.id = b.association_id
                       where u.id = p_entity_id)
    when 'owner' then (select o.full_name from public.owners o where o.id = p_entity_id)
    when 'vendor' then (select v.name from public.vendors v where v.id = p_entity_id)
  end;
$$;

-- ---------------------------------------------------------------- tags
drop policy if exists tags_staff_all on public.tags;
create policy tags_staff_read on public.tags for select to authenticated
  using (public.can_access_portfolio(portfolio_id));
create policy tags_staff_write on public.tags for all to authenticated
  using (public.can_access_portfolio(portfolio_id))
  with check (public.can_access_portfolio(portfolio_id));

drop policy if exists tag_assignments_staff_all on public.tag_assignments;
create policy tag_assignments_staff_read on public.tag_assignments for select to authenticated
  using (exists (select 1 from public.tags t where t.id = tag_id and public.can_access_portfolio(t.portfolio_id)));
revoke insert, update on public.tag_assignments from authenticated;
revoke all on public.tags, public.tag_assignments from anon;
create policy tag_assignments_staff_delete on public.tag_assignments for delete to authenticated
  using (exists (select 1 from public.tags t where t.id = tag_id and public.can_access_portfolio(t.portfolio_id)));

create index if not exists tag_assignments_entity_idx on public.tag_assignments (entity_type, entity_id);

create or replace function public.set_record_tags(p_entity_type text, p_entity_id uuid, p_tags text[])
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.record_portfolio_id(p_entity_type, p_entity_id);
  v_names text[];
  v_before text[];
begin
  if p_entity_type not in ('association', 'unit', 'owner', 'vendor') then
    raise exception 'Tags are not supported on this record' using errcode = '22023';
  end if;
  if v_pid is null or not public.can_access_portfolio(v_pid) then
    raise exception 'Record not found' using errcode = 'P0002';
  end if;

  -- One entry per tag, case-insensitively; an existing tag keeps its spelling.
  select coalesce(array_agg(coalesce(t.name, d.n) order by lower(d.n)), '{}') into v_names
    from (select distinct on (lower(n)) n
            from (select btrim(regexp_replace(x, '\s+', ' ', 'g')) n, i
                    from unnest(coalesce(p_tags, '{}')) with ordinality u(x, i)) s
           where length(n) between 1 and 40
           order by lower(n), i) d
    left join public.tags t on t.portfolio_id = v_pid and lower(t.name) = lower(d.n);
  if cardinality(v_names) > 20 then
    raise exception 'A record can have at most 20 tags' using errcode = '22023';
  end if;

  select coalesce(array_agg(t.name order by lower(t.name)), '{}') into v_before
    from public.tag_assignments ta join public.tags t on t.id = ta.tag_id
   where ta.entity_type = p_entity_type::public.tag_entity_type and ta.entity_id = p_entity_id;

  -- Reuse existing tags case-insensitively so "Pool" and "pool" stay one tag.
  insert into public.tags (portfolio_id, name)
  select v_pid, n from unnest(v_names) n
   where not exists (select 1 from public.tags t where t.portfolio_id = v_pid and lower(t.name) = lower(n));

  delete from public.tag_assignments ta using public.tags t
   where t.id = ta.tag_id and ta.entity_type = p_entity_type::public.tag_entity_type
     and ta.entity_id = p_entity_id
     and not exists (select 1 from unnest(v_names) n where lower(n) = lower(t.name));

  insert into public.tag_assignments (tag_id, entity_type, entity_id, created_by)
  select t.id, p_entity_type::public.tag_entity_type, p_entity_id, auth.uid()
    from public.tags t
   where t.portfolio_id = v_pid and exists (select 1 from unnest(v_names) n where lower(n) = lower(t.name))
  on conflict (tag_id, entity_type, entity_id) do nothing;

  if v_before is distinct from v_names then
    insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
    values (v_pid, p_entity_type, p_entity_id, 'tags_updated', auth.uid(),
            (select email from auth.users where id = auth.uid()),
            jsonb_build_object('before', to_jsonb(v_before), 'after', to_jsonb(v_names)));
  end if;
end $$;

-- ---------------------------------------------------------------- notes
create table if not exists public.record_notes (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  entity_type text not null check (entity_type in ('association', 'unit', 'owner', 'vendor')),
  entity_id uuid not null,
  body text not null check (length(btrim(body)) between 1 and 5000),
  mentioned_user_ids uuid[] not null default '{}',
  pinned boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null
);
create index if not exists record_notes_entity_idx on public.record_notes (entity_type, entity_id, created_at desc);
create index if not exists record_notes_mentions_idx on public.record_notes using gin (mentioned_user_ids);
alter table public.record_notes enable row level security;
drop policy if exists record_notes_staff_read on public.record_notes;
create policy record_notes_staff_read on public.record_notes for select to authenticated
  using (public.can_access_portfolio(portfolio_id));
revoke all on public.record_notes from anon;
revoke insert, update, delete on public.record_notes from authenticated;
grant select on public.record_notes to authenticated;

-- Staff the caller can @mention: active managers and company admins in their company.
create or replace function public.mentionable_staff()
returns table (id uuid, name text, email text)
language sql stable security definer set search_path = pg_catalog, public as $$
  select p.id, coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.display_name), ''), p.email), p.email
    from public.profiles p
   where (public.is_any_staff() or public.is_company_admin())
     and p.portfolio_id = public.current_portfolio_id()
     and p.disabled_at is null
     and p.hoa_role in ('manager', 'company_admin')
   order by 2;
$$;

create or replace function public.add_record_note(
  p_entity_type text, p_entity_id uuid, p_body text, p_mentions uuid[] default '{}', p_app_url text default null)
returns uuid language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare
  v_pid uuid := public.record_portfolio_id(p_entity_type, p_entity_id);
  v_body text := btrim(coalesce(p_body, ''));
  v_mentions uuid[];
  v_author text;
  v_label text;
  v_link text;
  v_id uuid;
  v_base text := coalesce(nullif(rtrim(p_app_url, '/'), ''), 'https://portier369.com');
  m record;
begin
  if p_entity_type not in ('association', 'unit', 'owner', 'vendor') then
    raise exception 'Notes are not supported on this record' using errcode = '22023';
  end if;
  if v_pid is null or not public.can_access_portfolio(v_pid) then
    raise exception 'Record not found' using errcode = 'P0002';
  end if;
  if length(v_body) = 0 then raise exception 'Write a note first' using errcode = '22023'; end if;
  if length(v_body) > 5000 then raise exception 'Notes are limited to 5,000 characters' using errcode = '22023'; end if;
  if v_base !~ '^https://[a-z0-9.-]+(:[0-9]+)?$' then v_base := 'https://portier369.com'; end if;

  -- Only colleagues in the same company can be mentioned; never yourself.
  select coalesce(array_agg(distinct p.id), '{}') into v_mentions
    from public.profiles p
   where p.id = any (coalesce(p_mentions, '{}'))
     and p.id <> auth.uid()
     and p.portfolio_id = v_pid and p.disabled_at is null
     and p.hoa_role in ('manager', 'company_admin');

  select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.display_name), ''), p.email) into v_author
    from public.profiles p where p.id = auth.uid();

  insert into public.record_notes (portfolio_id, entity_type, entity_id, body, mentioned_user_ids, created_by, created_by_name)
  values (v_pid, p_entity_type, p_entity_id, v_body, v_mentions, auth.uid(), v_author)
  returning id into v_id;

  if cardinality(v_mentions) > 0 then
    v_label := coalesce(public.record_label(p_entity_type, p_entity_id), 'a record');
    v_link := v_base || case p_entity_type when 'association' then '/associations/' when 'unit' then '/units/'
                                          when 'owner' then '/owners/' else '/vendors/' end
              || p_entity_id || '#notes';
    for m in select p.id, p.email, coalesce(nullif(btrim(p.full_name), ''), p.email) as name
               from public.profiles p where p.id = any (v_mentions) and p.email is not null loop
      insert into public.email_queue (to_email, to_name, subject, body, status, from_address, from_name,
                                      portfolio_id, sent_by, idempotency_key)
      values (m.email, m.name,
              left(coalesce(v_author, 'A colleague') || ' mentioned you on ' || v_label, 200),
              '<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;line-height:1.6;color:#111827">'
                || '<p><strong>' || replace(replace(replace(coalesce(v_author, 'A colleague'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
                || '</strong> mentioned you in a note on <strong>'
                || replace(replace(replace(v_label, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</strong>:</p>'
                || '<blockquote style="margin:0;padding:8px 12px;border-left:3px solid #d1d5db;white-space:pre-wrap;color:#374151">'
                || replace(replace(replace(v_body, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</blockquote>'
                || '<p><a href="' || v_link || '">Open the record</a></p></div>',
              'pending', 'noreply@portier369.com', 'Portier369', v_pid, auth.uid(),
              'mention:' || v_id || ':' || m.id)
      on conflict do nothing;
    end loop;
  end if;
  return v_id;
end $$;

create or replace function public.update_record_note(p_note_id uuid, p_pinned boolean default null, p_archive boolean default false)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare n record;
begin
  select * into n from public.record_notes where id = p_note_id for update;
  if not found or not public.can_access_portfolio(n.portfolio_id) then
    raise exception 'Note not found' using errcode = 'P0002';
  end if;
  if p_archive then
    if n.created_by is distinct from auth.uid() and not public.can_manage_finance(n.portfolio_id)
       and not public.is_company_admin() and not public.is_platform_operator() then
      raise exception 'Only the author or an administrator can remove this note' using errcode = '42501';
    end if;
    update public.record_notes set archived_at = now(), archived_by = auth.uid() where id = p_note_id;
    insert into public.audit_logs (portfolio_id, entity_type, entity_id, action, actor_id, actor_email, changes)
    values (n.portfolio_id, n.entity_type, n.entity_id, 'note_removed', auth.uid(),
            (select email from auth.users where id = auth.uid()),
            jsonb_build_object('note_id', n.id, 'body', left(n.body, 500), 'author', n.created_by_name));
  elsif p_pinned is not null then
    update public.record_notes set pinned = p_pinned where id = p_note_id;
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.set_record_tags(text, uuid, text[])',
    'public.add_record_note(text, uuid, text, uuid[], text)',
    'public.update_record_note(uuid, boolean, boolean)',
    'public.mentionable_staff()'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array['public.record_portfolio_id(text, uuid)', 'public.record_label(text, uuid)'] loop
    execute format('alter function %s owner to postgres', f);
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
