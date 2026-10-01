-- #106 review 2: a warning that is still true on the next scan is refreshed
-- (last_seen_at, occurrence_count) instead of left showing its first sighting.
do $$
declare def text;
begin
  def := pg_get_functiondef('public.app_scan_unapplied_credits(uuid)'::regprocedure);
  if def !~ 'from _unapplied_now c\s+on conflict do nothing;' then
    raise exception 'diagnostic_unapplied_credits_refresh: app_scan_unapplied_credits drifted';
  end if;
  def := regexp_replace(def, 'from _unapplied_now c\s+on conflict do nothing;',
    'from _unapplied_now c' || chr(10) ||
    '  on conflict (portfolio_id, category, (coalesce(entity_id, ''00000000-0000-0000-0000-000000000000''::uuid)), title) where resolved_at is null' || chr(10) ||
    '  do update set last_seen_at = now(), occurrence_count = public.data_diagnostics.occurrence_count + 1;');
  execute def;
end $$;
