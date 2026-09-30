-- Lockbox review fixes:
-- 1. Association-scoped property managers: every lockbox RPC now uses
--    can_manage_association() (which honours association_managers), and
--    lockbox_batches gets the same restrictive mgr_assoc_scope policy the
--    items already had, so a scoped manager neither sees nor acts on other
--    associations' batches.
-- 2. Review actions (match / reject) lock the batch row first — the same lock
--    post_lockbox_batch takes — then re-check the item, so a check can't be
--    re-pointed or rejected while it is being posted.
-- 3. Duplicate batch references are enforced by a unique index (per bank
--    account, case-insensitive) instead of check-then-insert.

drop policy if exists mgr_assoc_scope on public.lockbox_batches;
create policy mgr_assoc_scope on public.lockbox_batches as restrictive for all to authenticated
  using (public.can_view_association_row(association_id));

create unique index if not exists lockbox_batches_reference_uidx
  on public.lockbox_batches (bank_account_id, lower(deposit_reference)) where deposit_reference is not null;

do $$
declare v_def text;
begin
  select pg_get_functiondef('public.import_lockbox_batch(uuid, date, text, jsonb)'::regprocedure) into v_def;
  if position('or not public.can_access_association(v_bank.association_id) then' in v_def) = 0 then raise exception 'import scope not found'; end if;
  v_def := replace(v_def, 'or not public.can_access_association(v_bank.association_id) then', 'or not public.can_manage_association(v_bank.association_id) then');
  execute v_def;

  select pg_get_functiondef('public.post_lockbox_batch(uuid)'::regprocedure) into v_def;
  if position('or not public.can_access_association(b.association_id) then' in v_def) = 0 then raise exception 'post scope not found'; end if;
  execute replace(v_def, 'or not public.can_access_association(b.association_id) then', 'or not public.can_manage_association(b.association_id) then');
end $$;

create or replace function public.lockbox_item_scope(p_item uuid, out batch_id uuid, out association_id uuid, out posted boolean)
language plpgsql volatile security definer set search_path = pg_catalog, public as $$
declare v_batch uuid;
begin
  select i.batch_id into v_batch from public.lockbox_items i where i.id = p_item;
  if v_batch is null then raise exception 'Lockbox item not found' using errcode = 'P0002'; end if;
  -- Same lock order as post_lockbox_batch: batch, then item.
  perform 1 from public.lockbox_batches b where b.id = v_batch for update;
  select i.batch_id, b.association_id, i.payment_id is not null into batch_id, association_id, posted
    from public.lockbox_items i join public.lockbox_batches b on b.id = i.batch_id
   where i.id = p_item and public.can_manage_finance(b.portfolio_id) and public.can_manage_association(b.association_id)
   for update of i;
  if batch_id is null then raise exception 'Lockbox item not found' using errcode = 'P0002'; end if;
  if posted then raise exception 'That check is already posted' using errcode = '22023'; end if;
end $$;
revoke all on function public.lockbox_item_scope(uuid) from public, anon, authenticated;
