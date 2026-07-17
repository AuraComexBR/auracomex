-- Permitir que superadmins gerenciem o logo da plataforma (prefixo platform/) no bucket company-logos

CREATE POLICY "Superadmin can upload platform logo"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = 'platform'
    AND public.has_role(auth.uid(), 'superadmin'::app_role)
  );

CREATE POLICY "Superadmin can update platform logo"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = 'platform'
    AND public.has_role(auth.uid(), 'superadmin'::app_role)
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = 'platform'
    AND public.has_role(auth.uid(), 'superadmin'::app_role)
  );

CREATE POLICY "Superadmin can delete platform logo"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = 'platform'
    AND public.has_role(auth.uid(), 'superadmin'::app_role)
  );

CREATE POLICY "Superadmin can list platform logo"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = 'platform'
    AND public.has_role(auth.uid(), 'superadmin'::app_role)
  );