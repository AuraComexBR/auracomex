-- E-mail unico por empresa pra receber alertas de documentos vencendo,
-- em vez de escolher um e-mail toda vez que sobe um documento.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS document_alert_email text;
