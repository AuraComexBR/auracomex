ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS storage_fee_amount   numeric,
  ADD COLUMN IF NOT EXISTS storage_fee_currency text DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS storage_fee_note     text;