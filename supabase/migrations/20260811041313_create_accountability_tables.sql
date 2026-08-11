
-- Prestação de Contas (Numerário: orçado vs. pago real)
CREATE TABLE public.accountability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  quote_id UUID NOT NULL,
  estimate_id UUID NOT NULL REFERENCES public.cost_estimates(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'closed'
  usd_brl NUMERIC(12,6) DEFAULT 0, -- taxa fiscal travada no momento da geração do Numerário
  total_orcado_brl NUMERIC(14,2) DEFAULT 0,
  total_pago_brl NUMERIC(14,2) DEFAULT 0,
  diferenca_brl NUMERIC(14,2) DEFAULT 0, -- total_pago - total_orcado (positivo = adicional a cobrar; negativo = devolver ao cliente)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(quote_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accountability TO authenticated;
GRANT ALL ON public.accountability TO service_role;

ALTER TABLE public.accountability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_all" ON public.accountability
  FOR ALL USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());

CREATE TRIGGER update_accountability_updated_at
  BEFORE UPDATE ON public.accountability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_accountability_company ON public.accountability(company_id);
CREATE INDEX idx_accountability_quote ON public.accountability(quote_id);

-- Itens da Prestação de Contas (cada linha do Numerário: orçado travado + pago real editável)
CREATE TABLE public.accountability_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  accountability_id UUID NOT NULL REFERENCES public.accountability(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  categoria TEXT NOT NULL DEFAULT 'other', -- 'origin' | 'freight' | 'destination' | 'local' | 'tax' | 'afrmm' | 'siscomex' | 'other'
  descricao TEXT NOT NULL,
  valor_orcado_brl NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_pago_brl NUMERIC(14,2),
  confirmado BOOLEAN NOT NULL DEFAULT false,
  observacao TEXT,
  source_expense_id UUID REFERENCES public.cost_estimate_expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accountability_items TO authenticated;
GRANT ALL ON public.accountability_items TO service_role;

ALTER TABLE public.accountability_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_all" ON public.accountability_items
  FOR ALL USING (company_id = my_company_id()) WITH CHECK (company_id = my_company_id());

CREATE TRIGGER update_accountability_items_updated_at
  BEFORE UPDATE ON public.accountability_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_accountability_items_accountability ON public.accountability_items(accountability_id);
CREATE INDEX idx_accountability_items_company ON public.accountability_items(company_id);
