
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS master_bl text,
  ADD COLUMN IF NOT EXISTS house_bl text,
  ADD COLUMN IF NOT EXISTS ce_mercante_manifest text,
  ADD COLUMN IF NOT EXISTS ce_mercante_master text,
  ADD COLUMN IF NOT EXISTS ce_mercante_house text,
  ADD COLUMN IF NOT EXISTS next_update timestamp with time zone;
