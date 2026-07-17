
-- Add verification columns to charge_lines
ALTER TABLE public.charge_lines
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS supplier_amount numeric;

-- Add financial release flags to shipments
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS charges_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS financial_released boolean NOT NULL DEFAULT false;
