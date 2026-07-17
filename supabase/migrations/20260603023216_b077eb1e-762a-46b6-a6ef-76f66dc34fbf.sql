
-- Cost Estimates module
CREATE TABLE public.cost_estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  quote_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  incoterm TEXT,
  frequencia TEXT,
  transito TEXT,
  carrier TEXT,
  rota_origem TEXT,
  rota_destino TEXT,
  data_fiscal DATE NOT NULL DEFAULT CURRENT_DATE,
  usd_brl NUMERIC(12,6) DEFAULT 0,
  eur_brl NUMERIC(12,6) DEFAULT 0,
  rateio_metodo TEXT NOT NULL DEFAULT 'valor', -- 'valor' | 'peso'
  -- Totais consolidados (em USD e BRL)
  vmcv_usd NUMERIC(14,2) DEFAULT 0,
  vmcv_brl NUMERIC(14,2) DEFAULT 0,
  acrescimos_usd NUMERIC(14,2) DEFAULT 0,
  deducoes_usd NUMERIC(14,2) DEFAULT 0,
  frete_intl_usd NUMERIC(14,2) DEFAULT 0,
  seguro_intl_usd NUMERIC(14,2) DEFAULT 0,
  vmle_usd NUMERIC(14,2) DEFAULT 0,
  vmld_usd NUMERIC(14,2) DEFAULT 0,
  ii_usd NUMERIC(14,2) DEFAULT 0,
  ipi_usd NUMERIC(14,2) DEFAULT 0,
  pis_usd NUMERIC(14,2) DEFAULT 0,
  cofins_usd NUMERIC(14,2) DEFAULT 0,
  icms_usd NUMERIC(14,2) DEFAULT 0,
  despesas_nac_brl NUMERIC(14,2) DEFAULT 0,
  subtotal_usd NUMERIC(14,2) DEFAULT 0,
  total_usd NUMERIC(14,2) DEFAULT 0,
  total_brl NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quote_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_estimates TO authenticated;
GRANT ALL ON public.cost_estimates TO service_role;

ALTER TABLE public.cost_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company cost_estimates" ON public.cost_estimates
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert company cost_estimates" ON public.cost_estimates
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update company cost_estimates" ON public.cost_estimates
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users delete company cost_estimates" ON public.cost_estimates
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

CREATE TRIGGER update_cost_estimates_updated_at
  BEFORE UPDATE ON public.cost_estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cost_estimates_company ON public.cost_estimates(company_id);
CREATE INDEX idx_cost_estimates_quote ON public.cost_estimates(quote_id);

-- ITEMS
CREATE TABLE public.cost_estimate_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES public.cost_estimates(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  quote_item_id UUID,
  ordem INTEGER NOT NULL DEFAULT 0,
  ncm TEXT,
  nome TEXT NOT NULL DEFAULT '',
  peso NUMERIC(14,3) DEFAULT 0,
  quantidade NUMERIC(14,3) DEFAULT 0,
  vmcv_unit_usd NUMERIC(14,4) DEFAULT 0,
  aliq_ii NUMERIC(7,4) DEFAULT 0,
  aliq_ipi NUMERIC(7,4) DEFAULT 0,
  aliq_pis NUMERIC(7,4) DEFAULT 0,
  aliq_cofins NUMERIC(7,4) DEFAULT 0,
  aliq_icms NUMERIC(7,4) DEFAULT 0,
  -- Totais calculados rateados
  vmcv_usd NUMERIC(14,2) DEFAULT 0,
  vmle_usd NUMERIC(14,2) DEFAULT 0,
  frete_usd NUMERIC(14,2) DEFAULT 0,
  seguro_usd NUMERIC(14,2) DEFAULT 0,
  vmld_usd NUMERIC(14,2) DEFAULT 0,
  ii_usd NUMERIC(14,2) DEFAULT 0,
  ipi_usd NUMERIC(14,2) DEFAULT 0,
  pis_usd NUMERIC(14,2) DEFAULT 0,
  cofins_usd NUMERIC(14,2) DEFAULT 0,
  icms_usd NUMERIC(14,2) DEFAULT 0,
  despesas_usd NUMERIC(14,2) DEFAULT 0,
  total_usd NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_estimate_items TO authenticated;
GRANT ALL ON public.cost_estimate_items TO service_role;

ALTER TABLE public.cost_estimate_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company estimate_items" ON public.cost_estimate_items
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert company estimate_items" ON public.cost_estimate_items
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update company estimate_items" ON public.cost_estimate_items
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users delete company estimate_items" ON public.cost_estimate_items
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

CREATE INDEX idx_cost_estimate_items_estimate ON public.cost_estimate_items(estimate_id);
CREATE INDEX idx_cost_estimate_items_company ON public.cost_estimate_items(company_id);

-- EXPENSES
CREATE TABLE public.cost_estimate_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  estimate_id UUID NOT NULL REFERENCES public.cost_estimates(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  valor_brl NUMERIC(14,2) NOT NULL DEFAULT 0,
  aduaneira BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_estimate_expenses TO authenticated;
GRANT ALL ON public.cost_estimate_expenses TO service_role;

ALTER TABLE public.cost_estimate_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view company estimate_expenses" ON public.cost_estimate_expenses
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert company estimate_expenses" ON public.cost_estimate_expenses
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update company estimate_expenses" ON public.cost_estimate_expenses
  FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users delete company estimate_expenses" ON public.cost_estimate_expenses
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

CREATE INDEX idx_cost_estimate_expenses_estimate ON public.cost_estimate_expenses(estimate_id);
CREATE INDEX idx_cost_estimate_expenses_company ON public.cost_estimate_expenses(company_id);
