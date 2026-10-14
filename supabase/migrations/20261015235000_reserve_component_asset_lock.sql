-- Codex on #387: moving a fixed asset while another transaction links a
-- reserve component to it could commit a cross-association link (each check
-- missed the other's uncommitted row). The component check now share-locks
-- the asset row; the asset update locks the same row before its own guard
-- (fixed_assets_reserve_scope_guard) runs, so the two serialize and the
-- second one sees the first.
create or replace function public.enforce_reserve_component_scope()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  parent_portfolio uuid;
  parent_association uuid;
  asset_portfolio uuid;
  asset_association uuid;
begin
  select portfolio_id, association_id
    into parent_portfolio, parent_association
  from public.reserve_studies
  where id = new.study_id;

  if parent_portfolio is null
     or parent_portfolio <> new.portfolio_id
     or parent_association <> new.association_id then
    raise exception 'Reserve planning record must match its study scope';
  end if;

  if new.fixed_asset_id is not null then
    select portfolio_id, association_id
      into asset_portfolio, asset_association
    from public.fixed_assets
    where id = new.fixed_asset_id
    -- reserve_component_asset_lock: a share lock waits for (and blocks) a
    -- concurrent move of the asset, so the move's own check sees this link.
    for share;

    -- purchase_orders_fixes: an asset with no association matches nothing.
    if asset_portfolio is null
       or asset_portfolio <> new.portfolio_id
       or asset_association is distinct from new.association_id then
      raise exception 'The fixed asset must belong to the same association as this reserve study';
    end if;
  end if;

  return new;
end;
$function$;
