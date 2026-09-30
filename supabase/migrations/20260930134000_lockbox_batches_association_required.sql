-- Review fix: batches must carry their association so the mgr_assoc_scope
-- policy applies (can_view_association_row(NULL) is true). Backfill from the
-- bank account, then require it. (0 legacy rows in prod at the time.)
update public.lockbox_batches b set association_id = ba.association_id
  from public.bank_accounts ba where ba.id = b.bank_account_id and b.association_id is null;
delete from public.lockbox_batches where association_id is null and total_items = 0 and status = 'received';
alter table public.lockbox_batches alter column association_id set not null;
