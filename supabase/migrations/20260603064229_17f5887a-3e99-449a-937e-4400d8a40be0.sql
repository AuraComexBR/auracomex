ALTER TABLE public.cost_estimate_items
  ADD COLUMN IF NOT EXISTS ipi_na_base_icms boolean NOT NULL DEFAULT true;