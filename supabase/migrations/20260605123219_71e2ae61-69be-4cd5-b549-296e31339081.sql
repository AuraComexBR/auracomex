CREATE TABLE IF NOT EXISTS public.ncm_taxes_reference (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ncm_code TEXT NOT NULL UNIQUE,
    description TEXT,
    aliq_ii DECIMAL(10,4) DEFAULT 0,
    aliq_ipi DECIMAL(10,4) DEFAULT 0,
    aliq_pis DECIMAL(10,4) DEFAULT 0,
    aliq_cofins DECIMAL(10,4) DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.ncm_taxes_reference ENABLE ROW LEVEL SECURITY;

-- Permissões
GRANT SELECT ON public.ncm_taxes_reference TO authenticated;
GRANT ALL ON public.ncm_taxes_reference TO service_role;

-- Política de leitura
CREATE POLICY "Qualquer usuário autenticado pode ler a tabela de NCM"
    ON public.ncm_taxes_reference
    FOR SELECT
    USING (true);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ncm_taxes_reference_code ON public.ncm_taxes_reference(ncm_code);

-- Inserir alguns dados de exemplo (Comuns)
INSERT INTO public.ncm_taxes_reference (ncm_code, description, aliq_ii, aliq_ipi, aliq_pis, aliq_cofins)
VALUES 
('85171300', 'Smartphones', 11.2, 9.75, 2.1, 9.65),
('84713012', 'Laptops / Notebooks', 0, 0, 2.1, 9.65),
('85176215', 'Modems', 0, 0, 2.1, 9.65)
ON CONFLICT (ncm_code) DO NOTHING;