ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS brand_primary_color   text DEFAULT '#007BFF',
  ADD COLUMN IF NOT EXISTS brand_secondary_color text DEFAULT '#20C997';