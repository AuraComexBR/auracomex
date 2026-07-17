
ALTER TABLE public.quote_charges
  ADD COLUMN IF NOT EXISTS buy_amount_actual numeric,
  ADD COLUMN IF NOT EXISTS buy_actual_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS buy_actual_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS buy_variance_reason text,
  ADD COLUMN IF NOT EXISTS buy_variance_note text;

ALTER TABLE public.charge_lines
  ADD COLUMN IF NOT EXISTS buy_amount_actual numeric,
  ADD COLUMN IF NOT EXISTS buy_actual_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS buy_actual_confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS buy_variance_reason text,
  ADD COLUMN IF NOT EXISTS buy_variance_note text;
