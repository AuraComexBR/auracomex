-- Credenciais do Portal Único Siscomex (Chave de Acesso: Client-Id/Client-Secret)
-- por EMPRESA — cada cliente do AuraComex tem sua própria ligação com o Portal
-- Único (seu próprio despachante/e-CPF), nunca uma credencial compartilhada
-- entre tenants. Mesmo padrão de isolamento por company_id do resto do schema.
--
-- Importante: isto é uma integração DIFERENTE da já existente
-- company_siscomex_configs (que é para o Serpro Integra Comex, produto pago
-- e separado). Não reaproveitar/confundir as duas tabelas.
CREATE TABLE public.company_portalunico_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  client_secret text NOT NULL,
  role_type text NOT NULL DEFAULT 'IMPEXP',
  is_active boolean NOT NULL DEFAULT true,
  last_tested_at timestamptz,
  last_test_success boolean,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

ALTER TABLE public.company_portalunico_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company portalunico config" ON public.company_portalunico_configs
  FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());

CREATE POLICY "Users can insert own company portalunico config" ON public.company_portalunico_configs
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id());

CREATE POLICY "Users can update own company portalunico config" ON public.company_portalunico_configs
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id());

CREATE POLICY "Users can delete own company portalunico config" ON public.company_portalunico_configs
  FOR DELETE TO authenticated
  USING (company_id = public.my_company_id());

-- public.update_updated_at_column() consta no histórico de migrations mas
-- não existe mais na base atual (drift à parte, fora do escopo daqui) —
-- recriando de forma idempotente pra não depender disso.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_portalunico_configs_updated_at
  BEFORE UPDATE ON public.company_portalunico_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
