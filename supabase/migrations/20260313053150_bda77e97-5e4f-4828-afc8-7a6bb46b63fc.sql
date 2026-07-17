
-- Sequential reference counter per company
CREATE TABLE public.reference_counters (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  last_number integer NOT NULL DEFAULT 0
);

ALTER TABLE public.reference_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own company counter" ON public.reference_counters
  FOR ALL TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Function to generate next sequential reference
CREATE OR REPLACE FUNCTION public.next_reference(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_num integer;
BEGIN
  INSERT INTO reference_counters (company_id, last_number)
  VALUES (p_company_id, 1)
  ON CONFLICT (company_id) DO UPDATE SET last_number = reference_counters.last_number + 1
  RETURNING last_number INTO v_num;
  RETURN 'FF-' || LPAD(v_num::text, 5, '0');
END;
$$;

-- Add base_reference column to quotes for grouping multi-modal variants
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS base_reference text;
