DROP INDEX IF EXISTS public.cost_estimate_items_estimate_quote_item_unique;

CREATE UNIQUE INDEX IF NOT EXISTS cost_estimate_items_estimate_quote_item_unique
ON public.cost_estimate_items (estimate_id, quote_item_id);