-- The deployed app now passes p_as everywhere (#78), so the temporary
-- 3-arg post_message and 1-arg mark_message_thread_read shims added by
-- 20260930193000_message_center_compat_shims are removed. Only the explicit
-- versions remain.
drop function if exists public.post_message(uuid, text, boolean);
drop function if exists public.mark_message_thread_read(uuid);
