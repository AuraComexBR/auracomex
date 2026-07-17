-- Adiciona colunas para rastrear moeda original e categorizar despesas
ALTER TABLE public.cost_estimate_expenses ADD COLUMN IF NOT EXISTS valor_original NUMERIC;
ALTER TABLE public.cost_estimate_expenses ADD COLUMN IF NOT EXISTS moeda_original TEXT;
ALTER TABLE public.cost_estimate_expenses ADD COLUMN IF NOT EXISTS category TEXT;

-- Garante que as permissões continuem válidas para as novas colunas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_estimate_expenses TO authenticated;
GRANT ALL ON public.cost_estimate_expenses TO service_role;