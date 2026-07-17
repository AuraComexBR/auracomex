
-- Create shipment_status_options table for custom statuses per company
CREATE TABLE public.shipment_status_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipment_status_options ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view their company's status options
CREATE POLICY "Users can view company statuses"
  ON public.shipment_status_options
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- Admins can insert
CREATE POLICY "Admins can insert company statuses"
  ON public.shipment_status_options
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'))
  );

-- Admins can update
CREATE POLICY "Admins can update company statuses"
  ON public.shipment_status_options
  FOR UPDATE TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'))
  );

-- Admins can delete
CREATE POLICY "Admins can delete company statuses"
  ON public.shipment_status_options
  FOR DELETE TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'))
  );
