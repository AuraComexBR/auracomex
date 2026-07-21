-- Quando os planos comerciais foram criados (migration inicial de subscriptions),
-- toda company já existente ganhou 'business' ativo + todos os add-ons de cortesia
-- pra não travar ninguém durante o desenvolvimento. Agora que o paywall é real
-- (RBAC, limite de embarques, limite de assentos), isso mascara os testes.
--
-- Esse script reseta pro estado correto (trial Básico) SOMENTE as empresas que
-- nunca tiveram uma assinatura Stripe de verdade (stripe_subscription_id nulo) —
-- ou seja, só mexe em cortesias/testes, nunca em quem realmente pagou.
UPDATE public.company_subscriptions
SET
  plan = 'starter',
  status = 'trial',
  trial_ends_at = now() + INTERVAL '14 days',
  seats_limit = NULL,
  shipments_limit = 30,
  updated_at = now()
WHERE stripe_subscription_id IS NULL;

-- Desativa os add-ons de cortesia dessas mesmas empresas (não têm stripe_subscription_id
-- neles também, já que nunca foram comprados de verdade).
UPDATE public.company_addons ca
SET active = false, deactivated_at = now(), updated_at = now()
WHERE ca.stripe_subscription_id IS NULL
  AND ca.company_id IN (
    SELECT company_id FROM public.company_subscriptions WHERE stripe_subscription_id IS NULL
  );
