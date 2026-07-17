ALTER TABLE public.shipments 
  ADD COLUMN IF NOT EXISTS shipper_id uuid,
  ADD COLUMN IF NOT EXISTS consignee_id uuid,
  ADD COLUMN IF NOT EXISTS notify_id uuid;