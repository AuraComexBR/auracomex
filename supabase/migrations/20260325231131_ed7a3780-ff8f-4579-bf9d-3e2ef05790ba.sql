-- Add quote_start_number column
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS quote_start_number integer NOT NULL DEFAULT 1;

-- Drop quote_suffix column
ALTER TABLE public.companies DROP COLUMN IF EXISTS quote_suffix;

-- Recreate next_reference function
CREATE OR REPLACE FUNCTION public.next_reference(p_company_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE 
  v_num integer;
  v_prefix text;
  v_start integer;
BEGIN
  SELECT 
    CASE WHEN COALESCE(quote_prefix, '') = '' OR quote_prefix = 'FF' 
         THEN TO_CHAR(NOW(), 'YY') 
         ELSE quote_prefix 
    END,
    COALESCE(quote_start_number, 1)
  INTO v_prefix, v_start
  FROM companies WHERE id = p_company_id;

  INSERT INTO reference_counters (company_id, last_number)
  VALUES (p_company_id, GREATEST(1, v_start))
  ON CONFLICT (company_id) DO UPDATE 
    SET last_number = GREATEST(reference_counters.last_number + 1, v_start)
  RETURNING last_number INTO v_num;

  RETURN v_prefix || '-' || LPAD(v_num::text, 5, '0');
END;
$function$;