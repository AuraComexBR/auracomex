
-- Add billing_unit column to quote_charges for variable pricing (per ton, per m³, etc.)
ALTER TABLE public.quote_charges ADD COLUMN IF NOT EXISTS billing_unit text NOT NULL DEFAULT 'fixed';

-- Create quote_comments table
CREATE TABLE public.quote_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company quote_comments" ON public.quote_comments
  FOR SELECT USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert company quote_comments" ON public.quote_comments
  FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can delete company quote_comments" ON public.quote_comments
  FOR DELETE USING (company_id = get_user_company_id(auth.uid()));
