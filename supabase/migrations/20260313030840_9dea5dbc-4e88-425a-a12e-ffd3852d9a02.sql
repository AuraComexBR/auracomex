
-- Create charge_catalog table
CREATE TABLE public.charge_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  charge_type TEXT NOT NULL DEFAULT 'freight',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.charge_catalog ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view company charge_catalog" ON public.charge_catalog FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert company charge_catalog" ON public.charge_catalog FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can update company charge_catalog" ON public.charge_catalog FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete company charge_catalog" ON public.charge_catalog FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

-- Add leg and charge_catalog_id to quote_charges
ALTER TABLE public.quote_charges ADD COLUMN leg TEXT NOT NULL DEFAULT 'freight';
ALTER TABLE public.quote_charges ADD COLUMN charge_catalog_id UUID REFERENCES public.charge_catalog(id) ON DELETE SET NULL;
