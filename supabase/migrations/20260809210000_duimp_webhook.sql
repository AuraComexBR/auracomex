-- Integração real de status da DUIMP via webhook do Portal Único Siscomex.
--
-- Por quê webhook e não "consulta"? A API pública do Portal Único não tem
-- (ainda) um endpoint de CONSULTA síncrona de DUIMP pra intervenientes
-- privados — a página de documentação correspondente
-- (docs.portalunico.siscomex.gov.br/api/dimp/intervenientes-privados/)
-- existe mas está vazia/não publicada. O que É documentado e funciona é a
-- notificação PUSH de eventos (docs.portalunico.siscomex.gov.br/pages/webhooks/
-- e .../pages/duimp_eventos_intervenientes_privados/): a gente se inscreve
-- uma vez (POST /portal/api/ext/webhook, com o mesmo mTLS já validado) e o
-- Portal Único passa a chamar o NOSSO endpoint toda vez que a situação ou o
-- canal de uma DUIMP mudar. Não precisa de certificado pra RECEBER (é o
-- Portal Único batendo na nossa URL pública), só precisa dele pra assinar.

-- 1. Campo pra casar o evento recebido com o embarque certo.
ALTER TABLE public.shipments
  ADD COLUMN duimp_number text,
  ADD COLUMN duimp_version integer;

COMMENT ON COLUMN public.shipments.duimp_number IS 'Número da DUIMP (ex: 26BR00000000198) — usado pra casar com os eventos recebidos via webhook do Portal Único';
COMMENT ON COLUMN public.shipments.duimp_version IS 'Última versão da DUIMP informada no evento mais recente recebido';

CREATE INDEX idx_shipments_duimp_number ON public.shipments(duimp_number) WHERE duimp_number IS NOT NULL;

-- 2. Canal CINZA (ainda não parametrizado) também é retornado pelo Portal
-- Único, além de verde/amarelo/vermelho já suportados.
ALTER TABLE public.shipments DROP CONSTRAINT shipments_customs_channel_check;
ALTER TABLE public.shipments ADD CONSTRAINT shipments_customs_channel_check
  CHECK (customs_channel IN ('green', 'yellow', 'red', 'gray'));

-- 3. Dados da assinatura do webhook, por empresa (mesmo isolamento
-- multi-tenant do resto da integração Portal Único).
ALTER TABLE public.company_portalunico_configs
  ADD COLUMN webhook_secret text,
  ADD COLUMN webhook_auth_key text,
  ADD COLUMN webhook_subscription_ids jsonb,
  ADD COLUMN webhook_active boolean NOT NULL DEFAULT false,
  ADD COLUMN webhook_last_event_at timestamptz;

COMMENT ON COLUMN public.company_portalunico_configs.webhook_secret IS 'Chave secreta gerada por nós no momento da assinatura — vem de volta no header Secret de cada notificação, usada pra confirmar que o evento realmente pertence a essa empresa';
COMMENT ON COLUMN public.company_portalunico_configs.webhook_subscription_ids IS 'IDs das assinaturas ativas no Portal Único, por evento — ex: {"dimp-situacao-import": 123, "dimp-registro-import": 124}';

-- 4. Índice pra localizar rápido a empresa dona de um webhook_secret quando
-- o evento chega (o handler não tem company_id, só o secret enviado).
CREATE UNIQUE INDEX idx_company_portalunico_webhook_secret ON public.company_portalunico_configs(webhook_secret) WHERE webhook_secret IS NOT NULL;
