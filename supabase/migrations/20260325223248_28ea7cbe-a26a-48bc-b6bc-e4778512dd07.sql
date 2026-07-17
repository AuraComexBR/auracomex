
-- Add quote_suffix and is_foreign columns to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS quote_suffix text DEFAULT '';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_foreign boolean DEFAULT false;

-- Update next_reference function to include suffix
CREATE OR REPLACE FUNCTION public.next_reference(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE v_num integer;
        v_prefix text;
        v_suffix text;
BEGIN
  SELECT COALESCE(quote_prefix, 'FF'), COALESCE(quote_suffix, '')
  INTO v_prefix, v_suffix
  FROM companies WHERE id = p_company_id;

  INSERT INTO reference_counters (company_id, last_number)
  VALUES (p_company_id, 1)
  ON CONFLICT (company_id) DO UPDATE SET last_number = reference_counters.last_number + 1
  RETURNING last_number INTO v_num;

  IF v_suffix = '' THEN
    RETURN v_prefix || '-' || LPAD(v_num::text, 5, '0');
  ELSE
    RETURN v_prefix || '-' || LPAD(v_num::text, 5, '0') || '-' || v_suffix;
  END IF;
END;
$$;
