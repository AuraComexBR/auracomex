-- Bloqueio real (não só de UI) do limite de embarques/mês do plano. Conta embarques
-- criados desde o dia 1 do mês corrente; se a empresa tiver shipments_limit definido
-- e já tiver atingido, novos INSERTs em shipments são rejeitados.
CREATE OR REPLACE FUNCTION public.enforce_shipments_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
  v_month_start timestamptz;
BEGIN
  SELECT shipments_limit INTO v_limit FROM public.company_subscriptions WHERE company_id = NEW.company_id;

  IF v_limit IS NULL THEN
    RETURN NEW; -- sem limite (plano Business ou legado sem restrição)
  END IF;

  v_month_start := date_trunc('month', now());

  SELECT count(*) INTO v_count
  FROM public.shipments
  WHERE company_id = NEW.company_id AND created_at >= v_month_start;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Limite de % embarques/mês do plano atingido. Faça upgrade para continuar.', v_limit;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_shipments_limit ON public.shipments;
CREATE TRIGGER trg_enforce_shipments_limit
  BEFORE INSERT ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shipments_limit();
