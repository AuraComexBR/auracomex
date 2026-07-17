ALTER TABLE public.quote_charges
  ADD COLUMN IF NOT EXISTS aduaneira boolean NOT NULL DEFAULT false;

DELETE FROM public.cost_estimate_expenses WHERE source_charge_id IS NOT NULL;