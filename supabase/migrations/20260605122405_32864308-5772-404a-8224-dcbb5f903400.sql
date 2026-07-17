CREATE TABLE IF NOT EXISTS public.company_siscomex_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    serpro_consumer_key TEXT,
    serpro_consumer_secret TEXT,
    certificate_path TEXT,
    certificate_password TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(company_id)
);

-- Habilitar RLS
ALTER TABLE public.company_siscomex_configs ENABLE ROW LEVEL SECURITY;

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_siscomex_configs TO authenticated;
GRANT ALL ON public.company_siscomex_configs TO service_role;

-- Políticas de RLS
CREATE POLICY "Empresas podem gerenciar suas próprias configurações Siscomex"
    ON public.company_siscomex_configs
    FOR ALL
    USING (company_id IN (SELECT id FROM public.companies)); -- Ajustar conforme a lógica de posse de empresa do projeto

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_siscomex_configs_updated_at
    BEFORE UPDATE ON public.company_siscomex_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();