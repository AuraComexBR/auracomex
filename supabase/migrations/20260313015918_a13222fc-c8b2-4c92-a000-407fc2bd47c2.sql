
-- quote_items: cargo details per quote, mode-specific fields
CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  container_type text,
  container_qty integer DEFAULT 1,
  weight_kg numeric,
  volume_cbm numeric,
  chargeable_weight numeric,
  length_cm numeric,
  width_cm numeric,
  height_cm numeric,
  packages integer,
  commodity text,
  ncm_code text,
  dangerous_goods boolean DEFAULT false,
  vehicle_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company quote_items" ON public.quote_items FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert company quote_items" ON public.quote_items FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can update company quote_items" ON public.quote_items FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete company quote_items" ON public.quote_items FOR DELETE USING (company_id = get_user_company_id(auth.uid()));

-- quote_charges: pricing lines per quote
CREATE TABLE public.quote_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  description text NOT NULL,
  charge_type text NOT NULL DEFAULT 'freight',
  buy_amount numeric DEFAULT 0,
  sell_amount numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quote_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company quote_charges" ON public.quote_charges FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert company quote_charges" ON public.quote_charges FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can update company quote_charges" ON public.quote_charges FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete company quote_charges" ON public.quote_charges FOR DELETE USING (company_id = get_user_company_id(auth.uid()));
