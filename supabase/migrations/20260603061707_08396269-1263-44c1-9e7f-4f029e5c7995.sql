-- Backfill quote_item_id por commodity+NCM, depois deduplica itens da estimativa.
UPDATE public.cost_estimate_items cei
SET quote_item_id = qi.id
FROM public.cost_estimates ce
JOIN public.quote_items qi ON qi.quote_id = ce.quote_id
WHERE cei.estimate_id = ce.id
  AND cei.quote_item_id IS NULL
  AND COALESCE(NULLIF(cei.nome, ''), '') = COALESCE(qi.commodity, '')
  AND COALESCE(NULLIF(cei.ncm, ''), '') = COALESCE(qi.ncm_code, '');

DELETE FROM public.cost_estimate_items a
USING public.cost_estimate_items b
WHERE a.estimate_id = b.estimate_id
  AND a.quote_item_id IS NOT NULL
  AND a.quote_item_id = b.quote_item_id
  AND a.created_at < b.created_at;