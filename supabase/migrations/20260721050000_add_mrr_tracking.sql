-- Rastreamento de MRR real por empresa. Guardamos o valor calculado no momento em
-- que o webhook do Stripe confirma a assinatura (preço por assento aplicado sobre a
-- quantidade real comprada), em vez de recalcular na hora — assim o painel de
-- superadmin soma direto sem precisar bater no Stripe toda vez.
ALTER TABLE public.company_subscriptions
  ADD COLUMN IF NOT EXISTS mrr_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seats_active INTEGER;

COMMENT ON COLUMN public.company_subscriptions.mrr_cents IS 'Receita mensal recorrente em centavos, calculada no momento do upsert via webhook Stripe.';
COMMENT ON COLUMN public.company_subscriptions.seats_active IS 'Quantidade de assentos (quantity) da assinatura ativa no Stripe.';
