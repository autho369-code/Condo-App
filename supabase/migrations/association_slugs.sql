-- Give associations a short, human-readable slug for clean URLs
-- (e.g. /associations/granville-courts/units instead of the UUID).

-- Slugify: lowercase, drop common generic words, non-alnum -> hyphen, collapse.
CREATE OR REPLACE FUNCTION public.slugify_association_name(p_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $$
  select coalesce(nullif(
    trim(both '-' from
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(coalesce(p_name, '')),
            '\m(condominium|condominiums|condo|association|associations|assoc|hoa|homeowners|homeowner|owners|community|communities|incorporated|inc|llc|ltd|the)\M',
            ' ', 'g'),
          '[^a-z0-9]+', '-', 'g'),
        '-+', '-', 'g')
    ), ''), 'assoc');
$$;

-- Assign a slug on insert/update when missing, ensuring uniqueness with a suffix.
CREATE OR REPLACE FUNCTION public.associations_set_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if NEW.slug is not null and NEW.slug <> '' then
    return NEW;
  end if;
  base := public.slugify_association_name(NEW.name);
  candidate := base;
  while exists (select 1 from public.associations a where a.slug = candidate and a.id <> NEW.id) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  NEW.slug := candidate;
  return NEW;
end;
$$;

ALTER TABLE public.associations ADD COLUMN IF NOT EXISTS slug text;

-- Backfill existing rows (dedupe by appending -2, -3, ...).
DO $$
declare
  r record;
  base text;
  candidate text;
  n int;
begin
  for r in select id, name from public.associations where slug is null or slug = '' order by created_at loop
    base := public.slugify_association_name(r.name);
    candidate := base;
    n := 1;
    while exists (select 1 from public.associations a where a.slug = candidate and a.id <> r.id) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    update public.associations set slug = candidate where id = r.id;
  end loop;
end $$;

CREATE UNIQUE INDEX IF NOT EXISTS associations_slug_key ON public.associations (slug);

DROP TRIGGER IF EXISTS trg_associations_set_slug ON public.associations;
CREATE TRIGGER trg_associations_set_slug
  BEFORE INSERT OR UPDATE OF name, slug ON public.associations
  FOR EACH ROW EXECUTE FUNCTION public.associations_set_slug();
