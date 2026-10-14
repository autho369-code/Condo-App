-- Codex on #376 (P1) and the security review on #375: finance staff could
-- insert or change journal_entries and journal_lines directly (table grants +
-- journal_*_finance_all policies), including source_type, source_id and
-- posted. A hand-made, balanced, posted entry pointing at a charge could then
-- steer which account remove_late_fee reverses (or any other lookup that
-- finds a record's posting by its source), and could stand in for a system
-- posting.
--
-- The app never writes the journal directly: every posting goes through
-- SECURITY DEFINER functions and triggers (manual entries, batches,
-- reversals, charges, payments, bills, checks, transfers), which run as the
-- table owner and are unaffected. The only invoker writer,
-- record_check_run_legacy, can't be run by signed-in users. So signed-in
-- users lose direct writes on both tables; reads are unchanged.
--
-- Not a DROP or DELETE: a revoke of table privileges. Re-runnable.

revoke insert, update, delete on public.journal_entries from authenticated, anon;
revoke insert, update, delete on public.journal_lines from authenticated, anon;
