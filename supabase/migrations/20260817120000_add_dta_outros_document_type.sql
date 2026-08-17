-- Adiciona 'dta' e 'outros' como categorias fixas de documento (document_type),
-- para uso na aba Documentos (dentro de Logística) dos embarques.
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'dta';
ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'outros';
