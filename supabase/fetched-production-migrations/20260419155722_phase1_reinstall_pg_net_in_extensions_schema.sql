-- pg_net does not support ALTER EXTENSION ... SET SCHEMA, so drop and reinstall in the extensions schema.
-- Safe to do now because nothing consumes it yet (no cron jobs reference net.* functions).
drop extension if exists pg_net;
create extension pg_net with schema extensions;
;
