
-- 1. company_siscomex_configs: restringe à empresa do usuário
DROP POLICY IF EXISTS "Empresas podem gerenciar suas próprias configurações Siscome" ON public.company_siscomex_configs;
CREATE POLICY "Users manage own company siscomex configs"
  ON public.company_siscomex_configs
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- 2. user_roles: impedir auto-atribuição/escala de privilégios
DROP POLICY IF EXISTS "Admins can manage company roles" ON public.user_roles;
CREATE POLICY "Admins can manage company roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.get_user_company_id(user_id) = public.get_user_company_id(auth.uid())
    AND user_id <> auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND public.get_user_company_id(user_id) = public.get_user_company_id(auth.uid())
    AND user_id <> auth.uid()
    AND role <> 'superadmin'::app_role
  );

-- Superadmin também não pode se auto-modificar via essa policy geral
DROP POLICY IF EXISTS "Superadmin can manage all roles" ON public.user_roles;
CREATE POLICY "Superadmin can manage all roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'superadmin'::app_role) AND user_id <> auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role) AND user_id <> auth.uid());

-- 3. notifications: só o próprio usuário (ou service_role via triggers) pode inserir
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- 4. Storage: company-logos INSERT deve validar caminho == company_id do usuário
DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
CREATE POLICY "Users can upload own company logo"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
  );

-- Também protege UPDATE (upsert) de logo por caminho
DROP POLICY IF EXISTS "Admins can update company logos" ON storage.objects;
CREATE POLICY "Admins can update own company logo"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'superadmin'::app_role))
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
  );

DROP POLICY IF EXISTS "Admins can delete company logos" ON storage.objects;
CREATE POLICY "Admins can delete own company logo"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'superadmin'::app_role))
  );

-- Remove SELECT amplo do bucket (público continua acessível via URL direta / CDN)
DROP POLICY IF EXISTS "Anyone can read company logos" ON storage.objects;

-- 5. Storage: shipment-documents INSERT amarrado à empresa do usuário
DROP POLICY IF EXISTS "Authenticated users can upload shipment documents" ON storage.objects;
CREATE POLICY "Users can upload own company shipment documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shipment-documents'
    AND (storage.foldername(name))[1] = public.get_user_company_id(auth.uid())::text
  );

-- 6. documents: remove leitura anônima direta (tracking usa edge function com service role)
DROP POLICY IF EXISTS "Anon can read tracking documents" ON public.documents;
DROP POLICY IF EXISTS "Anon can read tracking documents" ON storage.objects;
REVOKE SELECT ON public.documents FROM anon;

-- 7. Funções: search_path fixo em update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- 8. Restringe EXECUTE das funções SECURITY DEFINER internas
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scan_payables_due() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_payable_due() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Funções auxiliares usadas em políticas RLS: apenas usuários autenticados
REVOKE EXECUTE ON FUNCTION public.get_user_company_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_company_id(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
