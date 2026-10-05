-- Defense in depth. Supabase's default grants give anon and authenticated
-- TRUNCATE, TRIGGER and REFERENCES on every public table. TRUNCATE ignores
-- row-level security, and none of the three is used by the app (PostgREST
-- never issues them). Revoke them on existing tables and for future tables.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate, trigger, references on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke truncate, trigger, references on tables from anon, authenticated;
