
-- Enums
DO $$ BEGIN
  CREATE TYPE public.debit_note_status AS ENUM ('pendente','em_conferencia','aprovada','rejeitada','paga');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.accounts_payable_status AS ENUM ('aberto','pago','atrasado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.accounts_payable_source AS ENUM ('debit_note','overhead','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- debit_notes
CREATE TABLE public.debit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  dn_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  currency TEXT NOT NULL DEFAULT 'BRL',
  exchange_rate NUMERIC(12,4) DEFAULT 1,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status public.debit_note_status NOT NULL DEFAULT 'pendente',
  file_url TEXT,
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debit_notes TO authenticated;
GRANT ALL ON public.debit_notes TO service_role;
ALTER TABLE public.debit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dn_company_all" ON public.debit_notes
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE TRIGGER trg_debit_notes_updated BEFORE UPDATE ON public.debit_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- debit_note_items
CREATE TABLE public.debit_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debit_note_id UUID NOT NULL REFERENCES public.debit_notes(id) ON DELETE CASCADE,
  quote_charge_id UUID REFERENCES public.quote_charges(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quoted_amount NUMERIC(14,2),
  charged_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  variance NUMERIC(14,2) GENERATED ALWAYS AS (COALESCE(charged_amount,0) - COALESCE(quoted_amount,0)) STORED,
  reason TEXT,
  reconciled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debit_note_items TO authenticated;
GRANT ALL ON public.debit_note_items TO service_role;
ALTER TABLE public.debit_note_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dni_via_dn" ON public.debit_note_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.debit_notes dn WHERE dn.id = debit_note_id AND dn.company_id = public.get_user_company_id(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.debit_notes dn WHERE dn.id = debit_note_id AND dn.company_id = public.get_user_company_id(auth.uid())));
CREATE TRIGGER trg_dni_updated BEFORE UPDATE ON public.debit_note_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- accounts_payable
CREATE TABLE public.accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  source public.accounts_payable_source NOT NULL DEFAULT 'manual',
  debit_note_id UUID REFERENCES public.debit_notes(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  status public.accounts_payable_status NOT NULL DEFAULT 'aberto',
  paid_at DATE,
  payment_method TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_payable TO authenticated;
GRANT ALL ON public.accounts_payable TO service_role;
ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ap_company_all" ON public.accounts_payable
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE TRIGGER trg_ap_updated BEFORE UPDATE ON public.accounts_payable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dn_company ON public.debit_notes(company_id);
CREATE INDEX idx_dn_quote ON public.debit_notes(quote_id);
CREATE INDEX idx_ap_company ON public.accounts_payable(company_id);
CREATE INDEX idx_ap_due ON public.accounts_payable(due_date);
CREATE INDEX idx_ap_status ON public.accounts_payable(status);
