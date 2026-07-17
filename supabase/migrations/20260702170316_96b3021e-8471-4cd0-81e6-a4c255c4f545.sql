
CREATE TABLE public.overhead_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#007BFF',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.overhead_categories TO authenticated;
GRANT ALL ON public.overhead_categories TO service_role;
ALTER TABLE public.overhead_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overhead_categories_company" ON public.overhead_categories
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE TRIGGER trg_overhead_categories_updated
  BEFORE UPDATE ON public.overhead_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.overhead_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.overhead_categories(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  amount_default NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  recurrence TEXT NOT NULL DEFAULT 'monthly',
  due_day INTEGER NOT NULL DEFAULT 5,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  payment_method TEXT,
  cost_center TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.overhead_expenses TO authenticated;
GRANT ALL ON public.overhead_expenses TO service_role;
ALTER TABLE public.overhead_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overhead_expenses_company" ON public.overhead_expenses
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE TRIGGER trg_overhead_expenses_updated
  BEFORE UPDATE ON public.overhead_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.overhead_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  overhead_expense_id UUID NOT NULL REFERENCES public.overhead_expenses(id) ON DELETE CASCADE,
  reference_month DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  amount_brl NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  payment_proof_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (overhead_expense_id, reference_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.overhead_entries TO authenticated;
GRANT ALL ON public.overhead_entries TO service_role;
ALTER TABLE public.overhead_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overhead_entries_company" ON public.overhead_entries
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE TRIGGER trg_overhead_entries_updated
  BEFORE UPDATE ON public.overhead_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_overhead_entries_company_month ON public.overhead_entries (company_id, reference_month);
CREATE INDEX idx_overhead_expenses_company_active ON public.overhead_expenses (company_id, active);
