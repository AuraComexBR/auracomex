ALTER TABLE public.quote_charges DROP COLUMN IF EXISTS percent_buy;
ALTER TABLE public.quote_charges DROP COLUMN IF EXISTS percent_sell;
ALTER TABLE public.quote_charges DROP COLUMN IF EXISTS calc_mode;
ALTER TABLE public.quote_charges ADD COLUMN IF NOT EXISTS percent_base_charge_ids uuid[];
ALTER TABLE public.quote_charges ADD COLUMN IF NOT EXISTS computed_buy_amount numeric;
ALTER TABLE public.quote_charges ADD COLUMN IF NOT EXISTS computed_sell_amount numeric;