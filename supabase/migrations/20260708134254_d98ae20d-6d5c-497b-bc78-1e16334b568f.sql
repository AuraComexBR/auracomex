DO $$ BEGIN
  CREATE TYPE public.accounts_receivable_status AS ENUM ('aberto','recebido','atrasado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.accounts_receivable_source AS ENUM ('debit_note','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.accounts_receivable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  source public.accounts_receivable_source NOT NULL DEFAULT 'debit_note',
  debit_note_id uuid,
  quote_id uuid,
  shipment_id uuid,
  client_id uuid,
  bank_account_id uuid,
  description text NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status public.accounts_receivable_status NOT NULL DEFAULT 'aberto',
  received_at date,
  received_amount numeric,
  receipt_reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_receivable TO authenticated;
GRANT ALL ON public.accounts_receivable TO service_role;

ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view AR"
ON public.accounts_receivable FOR SELECT
USING (company_id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Finance/admin can manage AR"
ON public.accounts_receivable FOR ALL
USING (
  company_id = public.get_user_company_id(auth.uid())
  AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'gerente') OR public.has_role(auth.uid(),'coordenador_financeiro')
    OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'superadmin')
  )
)
WITH CHECK (
  company_id = public.get_user_company_id(auth.uid())
  AND (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor')
    OR public.has_role(auth.uid(),'gerente') OR public.has_role(auth.uid(),'coordenador_financeiro')
    OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'superadmin')
  )
);

CREATE TRIGGER accounts_receivable_updated
BEFORE UPDATE ON public.accounts_receivable
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ar_company ON public.accounts_receivable(company_id);
CREATE INDEX IF NOT EXISTS idx_ar_debit_note ON public.accounts_receivable(debit_note_id);