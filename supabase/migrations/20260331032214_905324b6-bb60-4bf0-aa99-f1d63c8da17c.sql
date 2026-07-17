
-- ============================================
-- Fix storage bucket policies
-- ============================================

-- shipment-documents: Remove anon SELECT and DELETE, add ownership checks
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- Only allow authenticated users in the same company to read shipment documents
CREATE POLICY "Company users can read shipment documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'shipment-documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_url LIKE '%' || storage.objects.name
        AND d.company_id = get_user_company_id(auth.uid())
    )
  );

-- Allow anon to read only tracking-visible documents
CREATE POLICY "Anon can read tracking documents"
  ON storage.objects FOR SELECT TO anon
  USING (
    bucket_id = 'shipment-documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_url LIKE '%' || storage.objects.name
        AND d.visible_tracking = true
    )
  );

-- Authenticated users can upload to shipment-documents
CREATE POLICY "Authenticated users can upload shipment documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shipment-documents');

-- Only company users can delete their own shipment documents
CREATE POLICY "Company users can delete shipment documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'shipment-documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.file_url LIKE '%' || storage.objects.name
        AND d.company_id = get_user_company_id(auth.uid())
    )
  );

-- company-logos: Add ownership check for update/delete
DROP POLICY IF EXISTS "Allow public logo read" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated logo upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated logo update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated logo delete" ON storage.objects;

-- Anyone can read company logos (they are public)
CREATE POLICY "Anyone can read company logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'company-logos');

-- Authenticated users can upload logos
CREATE POLICY "Authenticated users can upload company logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos');

-- Only admins/superadmins can update company logos
CREATE POLICY "Admins can update company logos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
  );

-- Only admins/superadmins can delete company logos
CREATE POLICY "Admins can delete company logos"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role))
  );
