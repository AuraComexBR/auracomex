-- Limpa duplicidades existentes por item de carga vinculado,
-- preservando o registro com mais dados fiscais preenchidos.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY estimate_id, quote_item_id
      ORDER BY
        CASE WHEN COALESCE(vmcv_unit_usd, 0) > 0 THEN 1 ELSE 0 END DESC,
        (COALESCE(aliq_ii, 0) + COALESCE(aliq_ipi, 0) + COALESCE(aliq_pis, 0) + COALESCE(aliq_cofins, 0) + COALESCE(aliq_icms, 0)) DESC,
        created_at ASC,
        id ASC
    ) AS rn
  FROM public.cost_estimate_items
  WHERE quote_item_id IS NOT NULL
)
DELETE FROM public.cost_estimate_items cei
USING ranked r
WHERE cei.id = r.id
  AND r.rn > 1;

-- Garante atomicamente que um item de carga da cotação só tenha um item correspondente na estimativa.
CREATE UNIQUE INDEX IF NOT EXISTS cost_estimate_items_estimate_quote_item_unique
ON public.cost_estimate_items (estimate_id, quote_item_id)
WHERE quote_item_id IS NOT NULL;