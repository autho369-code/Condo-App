-- Codex on #387: 20261015230000 blocked signed-in inserts into approval_votes,
-- but approval_votes_platform_all still let a signed-in platform admin update
-- or delete a vote row, which fires the definer tally trigger and can change
-- a pending request outside record_approval_decision. Board votes are no
-- longer cast by signed-in users at all, so updates and deletes are refused
-- too. Reads are unchanged; database functions (definer) are unaffected.
drop policy if exists approval_votes_no_signed_in_update on public.approval_votes;
create policy approval_votes_no_signed_in_update on public.approval_votes
  as restrictive for update to authenticated, anon
  using (false)
  with check (false);

drop policy if exists approval_votes_no_signed_in_delete on public.approval_votes;
create policy approval_votes_no_signed_in_delete on public.approval_votes
  as restrictive for delete to authenticated, anon
  using (false);
