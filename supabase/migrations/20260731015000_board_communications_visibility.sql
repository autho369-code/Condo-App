-- Board members may review delivery history only for associations where they
-- hold an active board seat. The existing restrictive association-scope policy
-- remains in force and this policy grants SELECT only.
drop policy if exists communications_board_read on public.communications_log;
create policy communications_board_read
  on public.communications_log
  for select
  to authenticated
  using (
    public.is_board_user()
    and association_id in (select public.current_board_association_ids())
  );
