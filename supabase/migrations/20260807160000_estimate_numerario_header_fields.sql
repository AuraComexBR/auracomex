-- Campos extras pro cabeçalho do PDF de Numerário (SOLICITAÇÃO DE NUMERARIO),
-- que não tinham onde morar ainda: país de origem, armazém, peso líquido,
-- CBM total e a taxa de câmbio da agência de câmbio (diferente da taxa
-- fiscal usd_brl já usada nos cálculos de impostos).
ALTER TABLE public.cost_estimates
  ADD COLUMN IF NOT EXISTS pais_origem TEXT,
  ADD COLUMN IF NOT EXISTS armazem TEXT,
  ADD COLUMN IF NOT EXISTS peso_liquido_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS cbm_total NUMERIC,
  ADD COLUMN IF NOT EXISTS usd_brl_agencia NUMERIC;
