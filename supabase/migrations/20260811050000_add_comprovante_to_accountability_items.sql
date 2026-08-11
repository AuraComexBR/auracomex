ALTER TABLE public.accountability_items
  ADD COLUMN comprovante_document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN comprovante_url TEXT,
  ADD COLUMN comprovante_name TEXT;
