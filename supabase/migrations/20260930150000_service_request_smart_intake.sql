-- Smart maintenance intake.
--
-- Residents send everything through the service-request form: real repairs,
-- but also ledger questions, meeting minutes, insurance papers and duplicate
-- reports of the same broken light. Left unsorted, the queue grows until
-- nothing gets answered. Every new request is now:
--   * numbered (service requests "N", their work orders "N-1", "N-2", …;
--     until now neither table ever got a number),
--   * classified: maintenance vs. a non-maintenance question (account,
--     documents, insurance, move, access, governance), with a repair category,
--   * escalated when the text describes an emergency or an urgent problem
--     (priority is only ever raised, never lowered),
--   * checked against open requests at the same association for a likely
--     duplicate,
--   * given a first-response due time (emergency 2h, high 24h, normal 48h,
--     low 72h) that is met once staff acknowledge, reply, triage or merge it,
--   * alerted to the association's managers (and the company support inbox)
--     when it is an emergency.
-- Staff can acknowledge, reply-and-close, merge a duplicate or clear the flag.
-- Residents can still only cancel their own open request: a resident update
-- may change nothing but the status.

-- ── Numbering ───────────────────────────────────────────────────────────────
create table if not exists public.maintenance_number_counters (
  portfolio_id uuid primary key references public.portfolios(id) on delete cascade,
  last_value   integer not null default 0
);
alter table public.maintenance_number_counters enable row level security;
-- No policies: only the SECURITY DEFINER functions below touch it.

create or replace function public.next_maintenance_number(p_portfolio uuid)
returns integer language sql volatile security definer set search_path = pg_catalog, public as $$
  insert into public.maintenance_number_counters as c (portfolio_id, last_value)
  values (p_portfolio, 1)
  on conflict (portfolio_id) do update set last_value = c.last_value + 1
  returning last_value;
$$;
revoke all on function public.next_maintenance_number(uuid) from public, anon, authenticated;

-- ── Triage columns ──────────────────────────────────────────────────────────
alter table public.service_requests
  add column if not exists request_kind          text not null default 'maintenance'
    check (request_kind in ('maintenance', 'admin')),
  add column if not exists admin_topic           text
    check (admin_topic is null or admin_topic in ('account', 'documents', 'insurance', 'move', 'access', 'governance')),
  add column if not exists category              public.work_order_category,
  add column if not exists triage_reasons        text[] not null default '{}',
  add column if not exists submitted_priority    public.service_request_priority,
  add column if not exists duplicate_of          uuid references public.service_requests(id) on delete set null,
  add column if not exists duplicate_score       numeric(4,3),
  add column if not exists duplicate_reviewed    boolean not null default false,
  add column if not exists first_response_due_at timestamptz,
  add column if not exists acknowledged_at       timestamptz,
  add column if not exists acknowledged_by       uuid,
  add column if not exists resolution_note       text,
  add column if not exists resolved_at           timestamptz,
  add column if not exists resolved_by           uuid;

create index if not exists service_requests_open_assoc_idx
  on public.service_requests (association_id, created_at desc)
  where archived_at is null and status in ('open', 'waiting');
create index if not exists service_requests_duplicate_of_idx
  on public.service_requests (duplicate_of) where duplicate_of is not null;

-- ── Classifier ──────────────────────────────────────────────────────────────
create or replace function public.classify_service_request(
  p_text text,
  out kind text, out topic text, out category public.work_order_category,
  out priority_floor public.service_request_priority, out reasons text[])
language plpgsql immutable set search_path = pg_catalog, public as $$
declare
  t text := lower(coalesce(p_text, ''));
  m text;
begin
  reasons := '{}';
  priority_floor := 'low';

  m := substring(t from '\m(flood(ed|ing)?|burst( pipe)?|pipe burst|gas leak|gas smell|smell(s|ing)? (of |like )?gas|carbon monoxide|sparks?|sparking|burning smell|smell(s|ing)? (of |like )?burning|smoke (coming|from|in the)|sewage|sewer back(ing|up|s)?|no heat|water (is )?(pouring|gushing)|ceiling (collapsed|caving|is falling)|stuck in (the |an )?elevator|trapped)\M');
  if m is not null then
    priority_floor := 'emergency';
    reasons := reasons || ('Emergency wording: "' || m || '"');
  else
    m := substring(t from '\m(leak(s|ing|ed|age|y)?|no hot water|water damage|mold|mould|rats?|mice|mouse|roach(es)?|cockroach(es)?|bed ?bugs?|infest(ed|ation)?|no (power|electricity)|not locking|won''t lock|broken (lock|door|window|entry door)|urgent(ly)?|asap|emergency)\M');
    if m is not null then
      priority_floor := 'high';
      reasons := reasons || ('Urgent wording: "' || m || '"');
    end if;
  end if;

  category := case
    when t ~ '\m(rats?|mice|mouse|rodents?|roach(es)?|cockroach(es)?|pests?|exterminat\w*|bugs?|insects?|bed ?bugs?|ants|termites?|wasps?|bees)\M' then 'pest_control'
    when t ~ '\m(leak\w*|pipes?|drain\w*|toilets?|sinks?|faucets?|water heater|hot water|sewer|sewage|clog\w*|plumb\w*|showers?|tub|flood\w*|water)\M' then 'plumbing'
    when t ~ '\m(lights?|lighting|outlets?|breakers?|power|electric\w*|bulbs?|fuses?|wiring|sparks?|sparking)\M' then 'electrical'
    when t ~ '\m(dryers?|washers?|washing machine|dishwasher|refrigerator|fridge|stove|oven|microwave|garbage disposal|laundry)\M' then 'appliance'
    when t ~ '\m(heat\w*|a/c|ac|air condition\w*|hvac|furnace|boiler|vents?|ducts?|thermostat|radiators?)\M' then 'hvac'
    when t ~ '\m(weeds?|grass|trees?|lawn|landscap\w*|snow|shrubs?|bushes|mulch|branches|yard)\M' then 'landscaping'
    when t ~ '\m(hallways?|lobby|parking|garage|elevators?|mailbox(es)?|doors?|buzzer|intercom|roof|gutters?|stairs|stairwell|balcony|porch|chute|trash|debris|gate|windows?|ceiling|walls?)\M' then 'common_area'
    else null end;

  topic := case
    when t ~ '\m(ledger|statement|balance|late fees?|special assessment|invoice|refund|autopay|auto-pay|payments?|charged|move[- ]in (charge|fee)|dues)\M' then 'account'
    when t ~ '\m(move[- ]?(in|out)|moving (in|out)|movers?|my move|elevator reservation)\M' then 'move'
    when t ~ '\m(insurance|dec page|declarations? page|certificate of insurance|coi|hazard coverage|master policy|ho-?6)\M' then 'insurance'
    when t ~ '\m(minutes|bylaws|by-laws|declaration|rules and regulations|budget|financials|financial statements?|resale|estoppel|paid assessment letter|disclosure)\M' then 'documents'
    when t ~ '\m(key ?fobs?|fobs?|keys? (copy|copies|made)|call ?box|directory|buzzer code|gate code|garage (remote|opener))\M' then 'access'
    when t ~ '\m(board members?|contact the board|the board|meeting|vote|election|proxy)\M' then 'governance'
    else null end;

  -- A question about the account, documents or insurance is not a repair even
  -- if it mentions a place ("insurance for the common areas"); a move, access
  -- or board question is only treated as non-maintenance when nothing
  -- physical is described. Anything urgent stays maintenance.
  if topic is not null and priority_floor = 'low'
     and (category is null or topic in ('account', 'documents', 'insurance')) then
    kind := 'admin';
    category := 'other';
    reasons := reasons || ('Looks like a ' || case topic
      when 'account' then 'billing / account question'
      when 'documents' then 'document request'
      when 'insurance' then 'insurance question'
      when 'move' then 'move-in / move-out question'
      when 'access' then 'keys / access question'
      else 'board / governance question' end || ', not a repair');
  else
    kind := 'maintenance';
    topic := null;
    category := coalesce(category, 'general_repair');
  end if;
end $$;

create or replace function public.service_request_response_window(p_priority public.service_request_priority)
returns interval language sql immutable as $$
  select case p_priority when 'emergency' then interval '2 hours' when 'high' then interval '24 hours'
                         when 'low' then interval '72 hours' else interval '48 hours' end;
$$;

-- ── Intake trigger ──────────────────────────────────────────────────────────
create or replace function public.service_request_intake()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare
  c record;
  v_is_staff boolean := public.is_platform_operator() or public.is_any_staff() or public.is_company_admin();
  v_dup uuid; v_score numeric;
begin
  if not v_is_staff and auth.uid() is not null then
    -- Residents cannot pre-set staff fields.
    new.status := 'open';
    new.number := null; new.category := null;
    new.acknowledged_at := null; new.acknowledged_by := null;
    new.resolution_note := null; new.resolved_at := null; new.resolved_by := null;
  end if;

  if new.portfolio_id is null and new.association_id is not null then
    select portfolio_id into new.portfolio_id from public.associations where id = new.association_id;
  end if;
  if new.number is null and new.portfolio_id is not null then
    new.number := public.next_maintenance_number(new.portfolio_id)::text;
  end if;

  select * into c from public.classify_service_request(new.description);
  new.request_kind   := c.kind;
  new.admin_topic    := c.topic;
  new.category       := coalesce(new.category, c.category);
  new.triage_reasons := coalesce(c.reasons, '{}');
  new.submitted_priority := coalesce(new.priority, 'normal');
  new.priority := greatest(coalesce(new.priority, 'normal'), c.priority_floor);
  if new.priority > new.submitted_priority then
    new.triage_reasons := new.triage_reasons || ('Priority raised from ' || new.submitted_priority || ' to ' || new.priority);
  end if;
  new.first_response_due_at := coalesce(new.created_at, now()) + public.service_request_response_window(new.priority);

  new.duplicate_of := null; new.duplicate_score := null; new.duplicate_reviewed := false;
  if new.request_kind = 'maintenance' and new.association_id is not null and length(coalesce(new.description, '')) >= 10 then
    select s.id, round(extensions.similarity(lower(s.description), lower(new.description))::numeric, 3)
      into v_dup, v_score
      from public.service_requests s
     where s.association_id = new.association_id
       and s.archived_at is null
       and s.status in ('open', 'waiting')
       and s.duplicate_of is null
       and s.created_at > now() - interval '30 days'
       and (extensions.similarity(lower(s.description), lower(new.description)) >= 0.5
            or (s.unit_id is not distinct from new.unit_id and s.category = new.category
                and extensions.similarity(lower(s.description), lower(new.description)) >= 0.3))
     order by extensions.similarity(lower(s.description), lower(new.description)) desc, s.created_at
     limit 1;
    if v_dup is not null then
      new.duplicate_of := v_dup;
      new.duplicate_score := v_score;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_service_request_intake on public.service_requests;
create trigger trg_service_request_intake before insert on public.service_requests
  for each row execute function public.service_request_intake();

create or replace function public.service_request_guard_update()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_status public.service_request_status;
  v_is_staff boolean := public.is_platform_operator() or public.is_any_staff() or public.is_company_admin();
begin
  if not v_is_staff and auth.uid() is not null then
    -- Resident update (the only one RLS allows is cancelling): nothing but
    -- the status may change.
    v_status := new.status;
    new := old;
    new.status := v_status;
    new.updated_at := now();
    return new;
  end if;
  if old.acknowledged_at is null and new.acknowledged_at is null
     and (new.status is distinct from old.status or new.resolution_note is distinct from old.resolution_note)
     and auth.uid() is not null then
    new.acknowledged_at := now();
    new.acknowledged_by := auth.uid();
  end if;
  if new.acknowledged_at is null and new.priority is distinct from old.priority then
    new.first_response_due_at := old.created_at + public.service_request_response_window(new.priority);
  end if;
  return new;
end $$;

drop trigger if exists trg_service_request_guard_update on public.service_requests;
create trigger trg_service_request_guard_update before update on public.service_requests
  for each row execute function public.service_request_guard_update();

-- Emergency alert to the association's managers and the company inbox.
create or replace function public.service_request_emergency_alert()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_assoc text; v_unit text; v_company text; v_support text; r record;
begin
  if new.priority <> 'emergency' then return new; end if;
  begin
    select a.name into v_assoc from public.associations a where a.id = new.association_id;
    select u.unit_number into v_unit from public.units u where u.id = new.unit_id;
    select p.company_name, p.support_email into v_company, v_support from public.portfolios p where p.id = new.portfolio_id;
    for r in
      select distinct lower(btrim(e)) as email from (
        select pr.email as e
          from public.association_managers am join public.profiles pr on pr.id = am.user_id
         where am.association_id = new.association_id and am.ended_at is null and pr.disabled_at is null
        union all
        -- No association-scoped managers: every manager in the company.
        select pr.email
          from public.profiles pr
         where pr.portfolio_id = new.portfolio_id and pr.hoa_role = 'manager' and pr.disabled_at is null
           and not exists (select 1 from public.association_managers am
                            where am.association_id = new.association_id and am.ended_at is null)
        union all select v_support
      ) x where e is not null and btrim(e) like '%@%'
    loop
      insert into public.email_queue (to_email, subject, body, association_id, portfolio_id, from_name, idempotency_key)
      values (r.email,
              'EMERGENCY service request #' || coalesce(new.number, '') || ' — ' || coalesce(v_assoc, 'association') || coalesce(' unit ' || v_unit, ''),
              'An emergency service request was just submitted.' || chr(10) || chr(10)
                || 'Association: ' || coalesce(v_assoc, '—') || chr(10)
                || 'Unit: ' || coalesce(v_unit, 'common area') || chr(10)
                || 'Permission to enter: ' || case when new.permission_to_enter then 'yes' else 'no' end || chr(10) || chr(10)
                || coalesce(new.description, '') || chr(10) || chr(10)
                || 'Respond within 2 hours. Open the Service Requests queue in Portier369 to dispatch a vendor.',
              new.association_id, new.portfolio_id, coalesce(v_company, 'Portier369'),
              'sr-emergency:' || new.id || ':' || r.email);
    end loop;
  exception when others then
    raise warning 'service_request_emergency_alert failed for %: %', new.id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_service_request_emergency_alert on public.service_requests;
create trigger trg_service_request_emergency_alert after insert on public.service_requests
  for each row execute function public.service_request_emergency_alert();

-- Work order numbers: "N-k" under their service request, otherwise a fresh "N-1".
create or replace function public.work_order_assign_number()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_sr_number text; v_portfolio uuid; v_n int;
begin
  if new.number is not null then return new; end if;
  if new.service_request_id is not null then
    perform pg_advisory_xact_lock(hashtextextended('wo-number:' || new.service_request_id::text, 0));
    select number into v_sr_number from public.service_requests where id = new.service_request_id;
    if v_sr_number is not null then
      select coalesce(max(nullif(split_part(number, '-', 2), '')::int), 0) + 1 into v_n
        from public.work_orders
       where service_request_id = new.service_request_id and number ~ '^[0-9]+-[0-9]+$';
      new.number := v_sr_number || '-' || v_n;
      return new;
    end if;
  end if;
  v_portfolio := new.portfolio_id;
  if v_portfolio is null and new.association_id is not null then
    select portfolio_id into v_portfolio from public.associations where id = new.association_id;
  end if;
  if v_portfolio is not null then
    new.number := public.next_maintenance_number(v_portfolio) || '-1';
  end if;
  return new;
end $$;

drop trigger if exists trg_work_order_assign_number on public.work_orders;
create trigger trg_work_order_assign_number before insert on public.work_orders
  for each row execute function public.work_order_assign_number();

-- ── Staff actions ───────────────────────────────────────────────────────────
create or replace function public.service_request_staff_scope(p_id uuid)
returns public.service_requests language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v public.service_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v from public.service_requests where id = p_id and archived_at is null for update;
  if not found then raise exception 'Service request not found' using errcode = 'P0002'; end if;
  if not (public.is_platform_operator()
          or ((public.is_any_staff() or public.is_company_admin())
              and public.can_access_portfolio(v.portfolio_id)
              and public.can_manage_association(v.association_id))) then
    raise exception 'Service request not found' using errcode = 'P0002';
  end if;
  return v;
end $$;
revoke all on function public.service_request_staff_scope(uuid) from public, anon, authenticated;

create or replace function public.acknowledge_service_request(p_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v public.service_requests;
begin
  v := public.service_request_staff_scope(p_id);
  update public.service_requests
     set acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by = coalesce(acknowledged_by, auth.uid()), updated_at = now()
   where id = p_id;
end $$;

create or replace function public.resolve_service_request(p_id uuid, p_note text)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v public.service_requests; v_note text := nullif(btrim(p_note), '');
begin
  v := public.service_request_staff_scope(p_id);
  if v_note is null then raise exception 'Write the reply the resident will see' using errcode = '22023'; end if;
  if v.status not in ('open', 'waiting') then raise exception 'This request is already closed' using errcode = '22023'; end if;
  if exists (select 1 from public.work_orders w where w.service_request_id = p_id and w.archived_at is null
              and w.status not in ('done', 'completed', 'billed', 'closed', 'cancelled')) then
    raise exception 'A work order on this request is still open — finish or cancel it first' using errcode = '22023';
  end if;
  update public.service_requests
     set status = 'completed', resolution_note = v_note, resolved_at = now(), resolved_by = auth.uid(),
         acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by = coalesce(acknowledged_by, auth.uid()),
         updated_at = now()
   where id = p_id;
end $$;

create or replace function public.merge_service_request(p_id uuid, p_into uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v public.service_requests; t public.service_requests;
begin
  if p_id = p_into then raise exception 'A request cannot be merged into itself' using errcode = '22023'; end if;
  -- Lock both rows in a stable order.
  if p_id < p_into then
    v := public.service_request_staff_scope(p_id); t := public.service_request_staff_scope(p_into);
  else
    t := public.service_request_staff_scope(p_into); v := public.service_request_staff_scope(p_id);
  end if;
  if v.association_id is distinct from t.association_id then
    raise exception 'Only requests at the same association can be merged' using errcode = '22023';
  end if;
  if v.status not in ('open', 'waiting') or t.status not in ('open', 'waiting') then
    raise exception 'Both requests must still be open' using errcode = '22023';
  end if;
  if t.duplicate_of = p_id then
    raise exception 'That request is itself marked as a duplicate of this one' using errcode = '22023';
  end if;
  if exists (select 1 from public.work_orders w where w.service_request_id = p_id and w.archived_at is null
              and w.status <> 'cancelled') then
    raise exception 'This request already has a work order — cancel it before merging' using errcode = '22023';
  end if;
  update public.service_requests
     set status = 'cancelled', duplicate_of = p_into, duplicate_reviewed = true,
         resolution_note = 'Merged into request #' || coalesce(t.number, left(t.id::text, 8))
                           || ' — the same issue is already being handled there.',
         resolved_at = now(), resolved_by = auth.uid(),
         acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by = coalesce(acknowledged_by, auth.uid()),
         updated_at = now()
   where id = p_id;
  -- Anything already pointing at the merged request now points at the survivor.
  update public.service_requests set duplicate_of = p_into
   where duplicate_of = p_id and id <> p_into;
end $$;

create or replace function public.clear_service_request_duplicate(p_id uuid)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v public.service_requests;
begin
  v := public.service_request_staff_scope(p_id);
  update public.service_requests
     set duplicate_of = null, duplicate_score = null, duplicate_reviewed = true,
         acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by = coalesce(acknowledged_by, auth.uid()),
         updated_at = now()
   where id = p_id;
end $$;

create or replace function public.reclassify_service_request(p_id uuid, p_kind text, p_topic text, p_category public.work_order_category)
returns void language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v public.service_requests;
begin
  v := public.service_request_staff_scope(p_id);
  if p_kind not in ('maintenance', 'admin') then raise exception 'Unknown request type' using errcode = '22023'; end if;
  if p_kind = 'admin' and (p_topic is null or p_topic not in ('account', 'documents', 'insurance', 'move', 'access', 'governance')) then
    raise exception 'Pick what the question is about' using errcode = '22023';
  end if;
  update public.service_requests
     set request_kind = p_kind,
         admin_topic = case when p_kind = 'admin' then p_topic end,
         category = case when p_kind = 'admin' then 'other' else coalesce(p_category, category, 'general_repair') end,
         acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by = coalesce(acknowledged_by, auth.uid()),
         updated_at = now()
   where id = p_id;
end $$;

revoke all on function public.acknowledge_service_request(uuid) from public, anon;
revoke all on function public.resolve_service_request(uuid, text) from public, anon;
revoke all on function public.merge_service_request(uuid, uuid) from public, anon;
revoke all on function public.clear_service_request_duplicate(uuid) from public, anon;
revoke all on function public.reclassify_service_request(uuid, text, text, public.work_order_category) from public, anon;
grant execute on function public.acknowledge_service_request(uuid) to authenticated;
grant execute on function public.resolve_service_request(uuid, text) to authenticated;
grant execute on function public.merge_service_request(uuid, uuid) to authenticated;
grant execute on function public.clear_service_request_duplicate(uuid) to authenticated;
grant execute on function public.reclassify_service_request(uuid, text, text, public.work_order_category) to authenticated;

-- Triage → work order: scoped managers, carry the category, count as a response.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.triage_service_request_to_work_order(uuid)'::regprocedure) into v_def;
  if position('and public.can_access_association(v_request.association_id)' in v_def) = 0 then raise exception 'triage scope anchor not found'; end if;
  v_def := replace(v_def, 'and public.can_access_association(v_request.association_id)', 'and public.can_manage_association(v_request.association_id)');
  if position(E'    ''other'',\n    v_request.priority' in v_def) = 0 then raise exception 'triage category anchor not found'; end if;
  v_def := replace(v_def, E'    ''other'',\n    v_request.priority', E'    coalesce(v_request.category, ''general_repair''),\n    v_request.priority');
  if position('set status = ''waiting'', updated_at = now()' in v_def) = 0 then raise exception 'triage status anchor not found'; end if;
  v_def := replace(v_def, 'set status = ''waiting'', updated_at = now()',
    'set status = ''waiting'', updated_at = now(), acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by = coalesce(acknowledged_by, auth.uid())');
  execute v_def;
end $$;

-- ── Backfill ────────────────────────────────────────────────────────────────
do $$
declare r record; c record;
begin
  for r in select id, portfolio_id, description, priority, created_at from public.service_requests
            where number is null and portfolio_id is not null order by created_at, id loop
    update public.service_requests set number = public.next_maintenance_number(r.portfolio_id)::text where id = r.id;
  end loop;
  for r in select id, description, priority, created_at, category from public.service_requests loop
    select * into c from public.classify_service_request(r.description);
    update public.service_requests
       set request_kind = c.kind, admin_topic = c.topic, category = coalesce(r.category, c.category),
           triage_reasons = coalesce(c.reasons, '{}'), submitted_priority = r.priority,
           first_response_due_at = r.created_at + public.service_request_response_window(r.priority),
           acknowledged_at = case when status <> 'open' then coalesce(updated_at, created_at) end
     where id = r.id;
  end loop;
  for r in select w.id, w.service_request_id, coalesce(w.portfolio_id, a.portfolio_id) as portfolio_id
             from public.work_orders w left join public.associations a on a.id = w.association_id
            where w.number is null order by w.created_at, w.id loop
    if r.service_request_id is not null and exists (select 1 from public.service_requests s where s.id = r.service_request_id and s.number is not null) then
      update public.work_orders w
         set number = (select s.number from public.service_requests s where s.id = r.service_request_id) || '-' ||
                      (select count(*) + 1 from public.work_orders x where x.service_request_id = r.service_request_id and x.number is not null)
       where w.id = r.id;
    elsif r.portfolio_id is not null then
      update public.work_orders set number = public.next_maintenance_number(r.portfolio_id) || '-1' where id = r.id;
    end if;
  end loop;
end $$;
