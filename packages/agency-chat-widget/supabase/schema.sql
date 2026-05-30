-- Agency Booking Agent — Supabase Schema
-- Tables: leads, bookings, service_catalog
-- Run: supabase db push or apply via Supabase dashboard SQL editor

-- ─── Service Catalog ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_catalog (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  duration_minutes integer DEFAULT 60,
  price       numeric(10, 2),
  category    text,
  is_active   boolean DEFAULT true,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active services"
  ON public.service_catalog FOR SELECT
  USING (is_active = true);

-- ─── Leads ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation  jsonb DEFAULT '[]',       -- Array of {role, text, timestamp}
  name          text,
  email         text,
  phone         text,
  qualification text DEFAULT 'new',        -- new, hot, warm, cold, converted, archived
  score         integer DEFAULT 0,
  summary       text,                      -- AI-generated lead summary
  source        text,                      -- widget, form, api, manual
  metadata      jsonb DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert leads from widget"
  ON public.leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff read leads"
  ON public.leads FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── Bookings ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid REFERENCES public.leads(id),
  service_id      uuid REFERENCES public.service_catalog(id),
  client_name     text NOT NULL,
  client_email    text NOT NULL,
  client_phone    text,
  scheduled_at    timestamptz NOT NULL,
  duration_minutes integer DEFAULT 60,
  status          text DEFAULT 'confirmed',  -- confirmed, cancelled, completed, no_show
  external_id     text,                      -- cal.diy or calendar event ID
  notes           text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert bookings from widget"
  ON public.bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Staff read bookings"
  ON public.bookings FOR SELECT
  USING (auth.role() = 'authenticated');

-- ─── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_leads_qualification ON public.leads(qualification);
CREATE INDEX IF NOT EXISTS idx_leads_created ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled ON public.bookings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_service_catalog_category ON public.service_catalog(category);
