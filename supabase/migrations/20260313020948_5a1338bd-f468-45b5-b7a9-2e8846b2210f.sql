
-- Create enums for charge direction and invoice status
CREATE TYPE public.charge_direction AS ENUM ('payable', 'receivable');
CREATE TYPE public.invoice_status_type AS ENUM ('pending', 'invoiced', 'paid');

-- Create charge_lines table
CREATE TABLE public.charge_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  direction charge_direction NOT NULL,
  partner_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  charge_type charge_type NOT NULL DEFAULT 'freight',
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  exchange_rate numeric NOT NULL DEFAULT 1,
  tax_rate numeric NOT NULL DEFAULT 0,
  invoice_number text,
  invoice_status invoice_status_type NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.charge_lines ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view company charge_lines" ON public.charge_lines FOR SELECT USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can insert company charge_lines" ON public.charge_lines FOR INSERT WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can update company charge_lines" ON public.charge_lines FOR UPDATE USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users can delete company charge_lines" ON public.charge_lines FOR DELETE USING (company_id = get_user_company_id(auth.uid()));
