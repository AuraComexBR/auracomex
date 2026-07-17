
-- Enums
CREATE TYPE public.subscription_plan AS ENUM ('starter','professional','business');
CREATE TYPE public.subscription_status AS ENUM ('trial','active','past_due','canceled');
CREATE TYPE public.addon_key AS ENUM ('cost_estimate_premium','tracking_portal','ai_import','multi_company');

-- Subscriptions (1:1 com companies)
CREATE TABLE public.company_subscriptions (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'starter',
  status public.subscription_status NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  seats_limit INTEGER,
  shipments_limit INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_subscriptions TO authenticated;
GRANT ALL ON public.company_subscriptions TO service_role;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_select_own_company" ON public.company_subscriptions
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(),'superadmin'));

CREATE POLICY "sub_superadmin_all" ON public.company_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'superadmin'));

CREATE TRIGGER trg_company_subscriptions_updated
  BEFORE UPDATE ON public.company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Addons (N por company)
CREATE TABLE public.company_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  addon_key public.addon_key NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, addon_key)
);

GRANT SELECT ON public.company_addons TO authenticated;
GRANT ALL ON public.company_addons TO service_role;
ALTER TABLE public.company_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "addons_select_own_company" ON public.company_addons
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) OR public.has_role(auth.uid(),'superadmin'));

CREATE POLICY "addons_superadmin_all" ON public.company_addons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'superadmin'))
  WITH CHECK (public.has_role(auth.uid(),'superadmin'));

CREATE TRIGGER trg_company_addons_updated
  BEFORE UPDATE ON public.company_addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função: verifica se company tem addon (Business = todos automaticamente)
CREATE OR REPLACE FUNCTION public.company_has_addon(_company_id UUID, _addon public.addon_key)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    -- Business inclui todos EXCETO multi_company (esse é sempre por concessão explícita)
    CASE
      WHEN _addon = 'multi_company' THEN
        EXISTS (SELECT 1 FROM public.company_addons WHERE company_id=_company_id AND addon_key=_addon AND active=true)
      ELSE
        EXISTS (
          SELECT 1 FROM public.company_subscriptions
          WHERE company_id=_company_id AND plan='business' AND status IN ('trial','active')
        )
        OR EXISTS (SELECT 1 FROM public.company_addons WHERE company_id=_company_id AND addon_key=_addon AND active=true)
    END
$$;

-- Seed: toda company existente → business + todos os 4 addons ativos
INSERT INTO public.company_subscriptions (company_id, plan, status)
SELECT id, 'business', 'active' FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

INSERT INTO public.company_addons (company_id, addon_key, active)
SELECT c.id, k.addon, true
FROM public.companies c
CROSS JOIN (VALUES ('cost_estimate_premium'::public.addon_key),('tracking_portal'),('ai_import'),('multi_company')) AS k(addon)
ON CONFLICT (company_id, addon_key) DO NOTHING;

-- Trigger: nova company criada → subscription starter/trial 14 dias, sem add-ons
CREATE OR REPLACE FUNCTION public.on_company_created_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.company_subscriptions (company_id, plan, status, trial_ends_at, seats_limit, shipments_limit)
  VALUES (NEW.id, 'professional', 'trial', now() + INTERVAL '14 days', 10, 100)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_company_new_subscription
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.on_company_created_subscription();
