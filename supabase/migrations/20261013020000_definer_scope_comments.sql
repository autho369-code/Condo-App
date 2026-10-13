-- Follow-ups to 20261013010000 (migration-reviewer on #335).
--
-- can_access_association now checks a scoped manager's associations; its
-- row-level copy rls_private.my_accessible_association_ids deliberately
-- stays company-wide (the restrictive mgr_assoc_scope policy narrows every
-- table that uses it). The old comment said "change both together".
-- app_record_in_manager_scope is only called inside definer functions;
-- signed-in users do not need to call it directly.
-- (record_meeting_attendance already goes through can_access_meeting, which
-- is scoped through can_access_association.)

comment on function public.can_access_association(uuid) is
  'Company access plus a scoped manager''s associations (can_view_association_row). '
  'Policies use the company-wide copy rls_private.my_accessible_association_ids; '
  'manager scope on those tables comes from the restrictive mgr_assoc_scope policy (20261013010000).';

revoke execute on function public.app_record_in_manager_scope(text, uuid) from authenticated;
