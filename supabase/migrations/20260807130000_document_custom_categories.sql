-- Permite que o usuário digite uma categoria de documento personalizada quando
-- escolhe "Outro" e, opcionalmente, salve essa categoria para reaproveitar em
-- próximos uploads (sem precisar mexer no enum document_type).

-- 1. Guarda o texto digitado quando document_type = 'other'.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS custom_category TEXT;

-- 2. Lista de categorias personalizadas por empresa, reaproveitável no select.
CREATE TABLE IF NOT EXISTS public.document_custom_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
ALTER TABLE public.document_custom_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company custom categories" ON public.document_custom_categories
  FOR SELECT USING (company_id = public.my_company_id());
CREATE POLICY "Users can insert company custom categories" ON public.document_custom_categories
  FOR INSERT WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "Users can delete company custom categories" ON public.document_custom_categories
  FOR DELETE USING (company_id = public.my_company_id());
