ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS lockbox_id     text;;
