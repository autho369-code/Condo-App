-- Backfill for 20261005061000_inspection_private_notes: any database that
-- still holds notes on the resident/vendor-readable parent row (staging, a
-- restored snapshot, rows written before the move trigger existed) gets them
-- copied to inspection_private, then cleared on the parent. Idempotent; an
-- existing private value wins. Production had none when this was written.

insert into public.inspection_private (inspection_id, notes, updated_at)
select i.id, nullif(btrim(i.notes), ''), now()
  from public.inspections i
 where i.notes is not null and btrim(i.notes) <> ''
on conflict (inspection_id) do update
  set notes = coalesce(public.inspection_private.notes, excluded.notes),
      updated_at = now();

update public.inspections set notes = null where notes is not null;
