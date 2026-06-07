-- Add multi-tenant subdomain support to portfolios
-- Enables white-label subdomains like stellarpropertygrp.portier369.com

-- 1. Add slug column for subdomain routing
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- 2. Add custom_domain for enterprise CNAME routing
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS custom_domain text UNIQUE;

-- 3. Auto-generate slugs from company_name for existing portfolios
UPDATE public.portfolios
SET slug = lower(regexp_replace(regexp_replace(company_name, '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
WHERE slug IS NULL AND company_name IS NOT NULL;

-- 4. Index for fast subdomain lookups
CREATE INDEX IF NOT EXISTS idx_portfolios_slug ON public.portfolios(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_portfolios_custom_domain ON public.portfolios(custom_domain) WHERE custom_domain IS NOT NULL;

-- 5. Add branding columns (if not already present)
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#10B981',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS support_email text,
  ADD COLUMN IF NOT EXISTS support_phone text,
  ADD COLUMN IF NOT EXISTS public_website text;

-- 6. Trigger: auto-generate slug on insert if not provided
CREATE OR REPLACE FUNCTION public.generate_portfolio_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL AND NEW.company_name IS NOT NULL THEN
    NEW.slug := lower(regexp_replace(regexp_replace(NEW.company_name, '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_portfolio_slug ON public.portfolios;
CREATE TRIGGER trg_generate_portfolio_slug
  BEFORE INSERT ON public.portfolios
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_portfolio_slug();
