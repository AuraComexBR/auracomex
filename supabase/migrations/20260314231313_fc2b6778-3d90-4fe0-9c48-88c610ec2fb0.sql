
CREATE TABLE public.shipment_partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(shipment_id, client_id)
);

ALTER TABLE public.shipment_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company shipment_partners" ON public.shipment_partners FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert company shipment_partners" ON public.shipment_partners FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete company shipment_partners" ON public.shipment_partners FOR DELETE USING (company_id = get_user_company_id(auth.uid()));
