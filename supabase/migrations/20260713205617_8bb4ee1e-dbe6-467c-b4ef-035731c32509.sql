ALTER TABLE public.quote_charges
  ADD COLUMN IF NOT EXISTS calc_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS percent_buy numeric,
  ADD COLUMN IF NOT EXISTS percent_sell numeric,
  ADD COLUMN IF NOT EXISTS percent_base_charge_ids uuid[];

ALTER TABLE public.quote_charges
  DROP CONSTRAINT IF EXISTS quote_charges_calc_mode_check;
ALTER TABLE public.quote_charges
  ADD CONSTRAINT quote_charges_calc_mode_check
  CHECK (calc_mode IN ('fixed','percent_of_base'));