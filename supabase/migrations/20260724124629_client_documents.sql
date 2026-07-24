-- Area de documentos no cadastro de clientes/fornecedores (nao ligados a
-- embarques). Reaproveita a tabela/bucket "documents" ja usada em
-- embarques/cotacoes, so adicionando os campos que faltam: vinculo com o
-- cliente, data de validade, e-mail de alerta e controle de envio do
-- lembrete (pra nao mandar o mesmo alerta mais de uma vez).
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS expires_at date;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS notify_email text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_documents_client_id ON public.documents(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON public.documents(expires_at) WHERE expires_at IS NOT NULL;

-- As policies de RLS/storage existentes em public.documents e
-- storage.objects (bucket shipment-documents) ja sao por company_id, sem
-- depender de shipment_id/quote_id — funcionam automaticamente pros
-- documentos de cliente tambem, sem precisar de policy nova.

-- Agenda a checagem diaria de documentos vencendo (roda a Edge Function
-- check-expiring-documents), reaproveitando o mesmo padrao/segredo do
-- Vault ja usado pelo cron do process-email-queue.
DO $$ BEGIN PERFORM cron.unschedule('check-expiring-documents'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'check-expiring-documents',
  '0 11 * * *', -- 11:00 UTC = 08:00 no horario de Brasilia
  $cron$
  SELECT net.http_post(
    url := 'https://pqiuxojgjmqhdajdhgqk.supabase.co/functions/v1/check-expiring-documents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);
