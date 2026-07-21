-- Bloqueio real (não só de UI): impede que uma empresa no plano Básico tenha um
-- usuário com papel fora da lista simples (admin, operator, financeiro, viewer).
-- Superadmin nunca é bloqueado (uso de suporte/backoffice via painel de superadmin).
CREATE OR REPLACE FUNCTION public.enforce_basic_plan_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_plan public.subscription_plan;
BEGIN
  IF NEW.role = 'superadmin' OR public.has_role(auth.uid(), 'superadmin') THEN
    RETURN NEW; -- papel superadmin, ou atribuição feita por um superadmin (backoffice), nunca é bloqueado
  END IF;

  SELECT company_id INTO v_company_id FROM public.profiles WHERE user_id = NEW.user_id;
  IF v_company_id IS NULL THEN
    RETURN NEW; -- perfil ainda não existe (ex.: convite em andamento) — nada a validar aqui
  END IF;

  SELECT plan INTO v_plan FROM public.company_subscriptions WHERE company_id = v_company_id;

  IF v_plan = 'starter' AND NEW.role::text NOT IN ('admin', 'operator', 'financeiro', 'viewer', 'client') THEN
    RAISE EXCEPTION 'Este cargo requer o plano Professional ou superior.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_basic_plan_role ON public.user_roles;
CREATE TRIGGER trg_enforce_basic_plan_role
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_basic_plan_role();
