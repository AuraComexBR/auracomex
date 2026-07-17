
-- Shipment audit log table
CREATE TABLE public.shipment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  user_id uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  field_name text NOT NULL,
  old_value text,
  new_value text
);

ALTER TABLE public.shipment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company audit" ON public.shipment_audit_log
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users can insert company audit" ON public.shipment_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Anon policies for public tracking page
CREATE POLICY "Anon can read company by cnpj" ON public.companies
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can read shipments for tracking" ON public.shipments
  FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can read clients for tracking" ON public.clients
  FOR SELECT TO anon USING (true);
