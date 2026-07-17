
-- 1. Novos valores no enum de status
ALTER TYPE public.debit_note_status ADD VALUE IF NOT EXISTS 'emitida';
ALTER TYPE public.debit_note_status ADD VALUE IF NOT EXISTS 'cancelada';

-- 2. Enum kind da DN
DO $$ BEGIN
  CREATE TYPE public.debit_note_kind AS ENUM ('partner_incoming', 'client_outgoing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Tabela company_bank_accounts
CREATE TABLE IF NOT EXISTS public.company_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  branch TEXT,
  account_number TEXT,
  account_holder TEXT NOT NULL,
  tax_id TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL',
  iban TEXT,
  swift TEXT,
  pix_key TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_bank_accounts TO authenticated;
GRANT ALL ON public.company_bank_accounts TO service_role;

ALTER TABLE public.company_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view bank accounts"
  ON public.company_bank_accounts FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Finance/admin can manage bank accounts"
  ON public.company_bank_accounts FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'diretor')
      OR public.has_role(auth.uid(), 'gerente')
      OR public.has_role(auth.uid(), 'coordenador_financeiro')
      OR public.has_role(auth.uid(), 'financeiro')
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'diretor')
      OR public.has_role(auth.uid(), 'gerente')
      OR public.has_role(auth.uid(), 'coordenador_financeiro')
      OR public.has_role(auth.uid(), 'financeiro')
    )
  );

CREATE TRIGGER update_company_bank_accounts_updated_at
  BEFORE UPDATE ON public.company_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Extensão de debit_notes
ALTER TABLE public.debit_notes
  ADD COLUMN IF NOT EXISTS kind public.debit_note_kind NOT NULL DEFAULT 'partner_incoming',
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid_at DATE,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS public_token TEXT UNIQUE;

-- 5. Função de numeração de DN
CREATE OR REPLACE FUNCTION public.next_dn_number(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_num integer;
  v_year text;
BEGIN
  v_year := TO_CHAR(NOW(), 'YY');

  SELECT COALESCE(MAX(
    CASE WHEN dn_number ~ ('^DN-' || v_year || '-[0-9]+$')
      THEN (regexp_replace(dn_number, '^DN-' || v_year || '-', ''))::integer
      ELSE 0
    END
  ), 0) + 1
  INTO v_num
  FROM public.debit_notes
  WHERE company_id = p_company_id;

  RETURN 'DN-' || v_year || '-' || LPAD(v_num::text, 6, '0');
END;
$$;
