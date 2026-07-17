
CREATE TABLE public.quote_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(quote_id, client_id)
);

ALTER TABLE public.quote_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company quote_partners" ON public.quote_partners
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert company quote_partners" ON public.quote_partners
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete company quote_partners" ON public.quote_partners
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));
