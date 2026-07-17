-- Add quote_prefix column to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS quote_prefix text NOT NULL DEFAULT 'FF';

-- Update next_reference function to use the company's prefix
CREATE OR REPLACE FUNCTION public.next_reference(p_company_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE v_num integer;
        v_prefix text;
BEGIN
  SELECT COALESCE(quote_prefix, 'FF') INTO v_prefix FROM companies WHERE id = p_company_id;
  
  INSERT INTO reference_counters (company_id, last_number)
  VALUES (p_company_id, 1)
  ON CONFLICT (company_id) DO UPDATE SET last_number = reference_counters.last_number + 1
  RETURNING last_number INTO v_num;
  
  RETURN v_prefix || '-' || LPAD(v_num::text, 5, '0');
END;
$$;

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to company-logos
CREATE POLICY "Users can upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-logos');

-- Allow anyone to view company logos (public)
CREATE POLICY "Anyone can view company logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Allow authenticated users to update/delete their logos
CREATE POLICY "Users can update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-logos');

CREATE POLICY "Users can delete company logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company-logos');