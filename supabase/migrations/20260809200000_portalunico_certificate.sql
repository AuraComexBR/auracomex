-- Certificado digital A1 por empresa, para a autenticação TLS mútua real no
-- Portal Único (a Chave de Acesso sozinha não basta — o handshake TLS exige
-- o certificado independente disso, confirmado via teste real:
-- "received fatal alert: HandshakeFailure").
ALTER TABLE public.company_portalunico_configs
  ADD COLUMN certificate_path text,
  ADD COLUMN certificate_password text;

-- Correção de segurança no bucket company-certificates: a policy de leitura
-- (storage_read_private) permitia SELECT para qualquer usuário autenticado
-- de QUALQUER empresa, sem checar company_id — só insert/update/delete eram
-- isolados por empresa. Como este bucket vai passar a guardar certificados
-- digitais reais (chave de assinatura perante a Receita Federal), a leitura
-- também precisa ser isolada por empresa. shipment-documents mantém o
-- comportamento anterior (não é o foco desta correção).
DROP POLICY IF EXISTS "storage_read_private" ON storage.objects;

CREATE POLICY "storage_read_private" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'shipment-documents');

CREATE POLICY "storage_read_certificates_own_company" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'company-certificates'
    AND (public.is_superadmin() OR (storage.foldername(name))[1] = (public.my_company_id())::text)
  );
