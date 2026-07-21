-- Agora só vendemos o plano Básico (armazenado como 'starter' no enum subscription_plan,
-- sem migration de enum) com preço por assento e 30 embarques/mês. O trial de novas
-- empresas estava sendo criado como 'professional' com limites que não correspondem
-- mais a nenhum plano oferecido — ajusta pra refletir o Básico.
CREATE OR REPLACE FUNCTION public.on_company_created_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_subscriptions (company_id, plan, status, trial_ends_at, seats_limit, shipments_limit)
  VALUES (NEW.id, 'starter', 'trial', now() + INTERVAL '14 days', NULL, 30)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Corrige quem já está em trial (ainda não pagou nada) pra também refletir o Básico.
-- Não toca em quem já tem assinatura ativa/paga — isso fica pra ajuste manual se precisar.
UPDATE public.company_subscriptions
SET plan = 'starter', seats_limit = NULL, shipments_limit = 30
WHERE status = 'trial' AND plan != 'starter';
