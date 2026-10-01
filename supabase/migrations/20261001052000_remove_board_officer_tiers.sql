-- Remove board officer permission tiers (#98). Decision (Mirsad 2026-10-01):
-- every board member sees and does the same thing.
--
-- Restores the board read/insert policies, can_read_association_budget and
-- cast_board_approval to "every active board member is equal". KEEPS the two
-- security fixes #98 shipped:
--   * board_comments inserts must target one of the author's board associations
--   * board users vote only through cast_board_approval (no direct
--     approval_decisions / approval_votes inserts)
-- The empty board_role_permissions table is left in place (dropping a table
-- needs explicit approval); nothing reads it any more.

-- Read and insert policies: permission-filtered set -> all board associations.
do $$
declare p record;
begin
  for p in
    select tablename, policyname, cmd, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~ 'current_board_association_ids_with\(' or coalesce(with_check, '') ~ 'current_board_association_ids_with\(')
       and policyname <> 'board_insert_comments'
  loop
    if p.qual is not null and p.qual ~ 'current_board_association_ids_with\(' then
      execute format('alter policy %I on public.%I using (%s)', p.policyname, p.tablename,
        regexp_replace(p.qual, 'current_board_association_ids_with\(''[a-z_]+''::text\)', 'current_board_association_ids()', 'g'));
    end if;
    if p.with_check is not null and p.with_check ~ 'current_board_association_ids_with\(' then
      execute format('alter policy %I on public.%I with check (%s)', p.policyname, p.tablename,
        regexp_replace(p.with_check, 'current_board_association_ids_with\(''[a-z_]+''::text\)', 'current_board_association_ids()', 'g'));
    end if;
  end loop;
end $$;

alter policy journal_entries_board_read on public.journal_entries
  using (public.is_board_user() and public.journal_entry_touches_board_associations(id));

-- Kept security fix: a board comment must belong to one of the author's board associations.
alter policy board_insert_comments on public.board_comments
  with check (author_id = (select auth.uid())
              and association_id in (select public.current_board_association_ids()));

do $$
declare def text;
begin
  def := pg_get_functiondef('public.can_read_association_budget(uuid)'::regprocedure);
  if def !~ 'current_board_association_ids_with\(''view_financials''\)' then
    raise exception 'remove_board_officer_tiers: can_read_association_budget drifted';
  end if;
  def := replace(def, 'public.current_board_association_ids_with(''view_financials'')', 'public.current_board_association_ids()');
  execute def;
end $$;

-- Every active board member votes and counts again (the RPC stays the only way to vote).
do $$
declare def text;
begin
  def := pg_get_functiondef('public.cast_board_approval(uuid, text, text, text)'::regprocedure);
  if def !~ 'board_member_can\(v_member_id, ''vote_approvals''\)' then
    raise exception 'remove_board_officer_tiers: cast_board_approval drifted';
  end if;
  def := regexp_replace(def,
    '\s*if not public\.board_member_can\(v_member_id, ''vote_approvals''\) then\s*raise exception [^;]*;\s*end if;', '');
  def := replace(def,
    'select count(*) into v_eligible from unnest(r.board_member_ids) as m(id) where public.board_member_can(m.id, ''vote_approvals'');',
    'v_eligible := cardinality(r.board_member_ids);');
  def := replace(def,
    'select count(*) into v_eligible from public.board_members where association_id = r.association_id and active and public.board_member_can(id, ''vote_approvals'');',
    'select count(*) into v_eligible from public.board_members where association_id = r.association_id and active;');
  if def ~ 'board_member_can' then
    raise exception 'remove_board_officer_tiers: cast_board_approval still references board_member_can';
  end if;
  execute def;
end $$;

drop function if exists public.my_board_permissions();
drop function if exists public.set_board_role_permissions(uuid, jsonb);
drop function if exists public.journal_entry_touches_board_financials(uuid);
drop function if exists public.board_member_can(uuid, text);
drop function if exists public.current_board_association_ids_with(text);
