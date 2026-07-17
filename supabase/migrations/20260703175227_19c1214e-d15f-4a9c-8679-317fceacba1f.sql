ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS courier_provider text,
  ADD COLUMN IF NOT EXISTS courier_tracking_number text;