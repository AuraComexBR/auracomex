ALTER TABLE public.cost_estimate_items
ADD COLUMN destinacao text NOT NULL DEFAULT 'consumo_final'
CHECK (destinacao IN ('consumo_final','revenda_industrializacao'));

UPDATE public.cost_estimate_items
SET destinacao = CASE WHEN ipi_na_base_icms THEN 'consumo_final' ELSE 'revenda_industrializacao' END;