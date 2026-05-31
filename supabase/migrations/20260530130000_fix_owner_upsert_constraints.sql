-- Fix: Add UNIQUE constraints on owner_id for tables that use upsert on owner_id
-- The app code calls .upsert({...}, { onConflict: 'owner_id' }) but these tables
-- only had PK on id, causing "no unique or exclusion constraint matching the ON CONFLICT specification"

BEGIN;

-- 1. owner_portal_invites — one pending/sent invite per owner
--    Clean up any duplicates first (keep most recent)
DELETE FROM public.owner_portal_invites a
USING public.owner_portal_invites b
WHERE a.owner_id = b.owner_id AND a.created_at < b.created_at;

ALTER TABLE public.owner_portal_invites
  ADD CONSTRAINT owner_portal_invites_owner_id_key UNIQUE (owner_id);

-- 2. owner_packets — one packet per owner
DELETE FROM public.owner_packets a
USING public.owner_packets b
WHERE a.owner_id = b.owner_id AND a.submitted_at < b.submitted_at;

ALTER TABLE public.owner_packets
  ADD CONSTRAINT owner_packets_owner_id_key UNIQUE (owner_id);

COMMIT;
