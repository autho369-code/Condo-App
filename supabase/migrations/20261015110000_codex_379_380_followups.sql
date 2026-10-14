-- Follow-ups to Codex's review of #379 and #380.
--
-- 1. Board access by email match (#379): 20261015100000 kept the email-match
--    branch of current_board_association_ids() whenever an active, unlinked
--    seat matched a board login, and the new linking trigger only runs on
--    future writes, so the branch could stay forever. Those seats are linked
--    to their login first (exactly the removed branch's conditions), then the
--    branch is removed. Production already has it removed (marker present):
--    a no-op there.
-- 2. Amenity hours that run past midnight (#380), e.g. 18:00-02:00, are
--    enforced by the resident insert guard: inside [opens, 24:00] on the start
--    day, inside [00:00, closes] on a day, or across midnight starting at or
--    after opening and ending the next day by closing. Normal hours keep the
--    same-day rule.
-- 3. Inspection search (#380): inspection_search(p_term) filters inspections
--    by type, association name, unit number, inspector name and the
--    staff-only notes in the database, under the caller's row-level security,
--    so the list pages and counts cover every match.
--
-- Re-runnable: each function patch checks its marker first and replaces an
-- anchor that must appear exactly once (carriage returns stripped). No DELETE
-- and no DROP.

-- ── 1. Board seats: link, then drop the email-match branch ─────────────────
do $$
declare
  d text := replace(pg_get_functiondef('public.current_board_association_ids()'::regprocedure), chr(13), '');
  a text := E'\n  union\n  select bm.association_id\n  from public.board_members bm\n  join public.associations a on a.id = bm.association_id and a.archived_at is null\n  join public.profiles p on p.id = auth.uid() and p.disabled_at is null and p.hoa_role = ''board'' and p.portfolio_id = a.portfolio_id\n  join auth.users u on u.id = auth.uid() and lower(u.email) = lower(bm.email)\n  where public.is_current_identity_enabled()\n    and bm.active\n    and bm.auth_user_id is null;';
  n integer;
begin
  if position('board_vendor_fixes' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception 'current_board_association_ids: anchor not found exactly once';
  end if;
  -- Exactly the seats the branch grants: active, unlinked, in a live
  -- association, matching the email of a board login of the same company
  -- that is not disabled.
  update public.board_members bm
     set auth_user_id = m.user_id
    from (
      select distinct on (b.id) b.id, p.id as user_id
        from public.board_members b
        join public.associations a on a.id = b.association_id and a.archived_at is null
        join auth.users u on lower(u.email) = lower(b.email)
        join public.profiles p on p.id = u.id and p.disabled_at is null and p.hoa_role = 'board' and p.portfolio_id = a.portfolio_id
       where b.active
         and b.auth_user_id is null
       order by b.id, p.id
    ) m
   where bm.id = m.id
     and bm.auth_user_id is null;
  get diagnostics n = row_count;
  raise notice 'current_board_association_ids: linked % board seat(s) to their login', n;
  execute replace(d, a, E';\n  -- board_vendor_fixes: linked login only, never by email match.');
end $$;

-- ── 2. Amenity hours past midnight ─────────────────────────────────────────
do $$
declare
  d text := replace(pg_get_functiondef('public.amenity_reservations_resident_insert_guard()'::regprocedure), chr(13), '');
  a text := E'    if v_end::date = v_start::date then\n      v_end_time := v_end::time;\n';
begin
  if position('codex_379_380_followups' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then
    raise exception 'amenity_reservations_resident_insert_guard: anchor not found exactly once';
  end if;
  execute replace(d, a, $new$    -- codex_379_380_followups: hours that run past midnight (e.g. 18:00-02:00).
    if am.opens_at is not null and am.closes_at is not null and am.opens_at > am.closes_at then
      if v_end::date = v_start::date then
        -- Inside [opens, 24:00] or inside [00:00, closes] on one day.
        if v_start::time < am.opens_at and v_end::time > am.closes_at then
          raise exception 'That time is outside the amenity''s hours' using errcode = '22023';
        end if;
      elsif v_end::date = v_start::date + 1 then
        -- Across midnight: from opening on the start day to closing the next.
        if v_start::time < am.opens_at or v_end::time > am.closes_at then
          raise exception 'That time is outside the amenity''s hours' using errcode = '22023';
        end if;
      else
        raise exception 'A reservation must end by the next day' using errcode = '22023';
      end if;
      return new;
    end if;
$new$ || a);
end $$;

-- ── 3. Inspection search in the database ───────────────────────────────────
create or replace function public.inspection_search(p_term text)
returns setof public.inspections
language sql
stable
security invoker
set search_path = pg_catalog, public
as $function$
  with t as (
    select '%' || replace(replace(replace(btrim(coalesce(p_term, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select i.*
    from public.inspections i, t
   where btrim(coalesce(p_term, '')) <> ''
     and (i.inspection_type ilike t.pat
          or exists (select 1 from public.associations a where a.id = i.association_id and a.name ilike t.pat)
          or exists (select 1 from public.units u where u.id = i.unit_id and u.unit_number ilike t.pat)
          or exists (select 1 from public.vendors v where v.id = i.inspector_vendor_id and v.name ilike t.pat)
          -- Staff-only notes: row-level security on inspection_private applies.
          or exists (select 1 from public.inspection_private p where p.inspection_id = i.id and p.notes ilike t.pat));
$function$;

revoke all on function public.inspection_search(text) from public, anon;
grant execute on function public.inspection_search(text) to authenticated;
