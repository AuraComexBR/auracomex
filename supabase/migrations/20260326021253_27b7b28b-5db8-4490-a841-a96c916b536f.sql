ALTER TABLE public.documents ALTER COLUMN shipment_id DROP NOT NULL;
ALTER TABLE public.documents ADD COLUMN quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE;