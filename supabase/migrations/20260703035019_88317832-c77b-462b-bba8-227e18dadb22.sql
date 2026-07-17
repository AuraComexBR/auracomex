
-- Fase 3: Trigger de notificação para Contas a Pagar próximas do vencimento
CREATE OR REPLACE FUNCTION public.notify_payable_due()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days_left integer;
  v_user record;
  v_title text;
  v_msg text;
BEGIN
  IF NEW.status <> 'aberto' THEN
    RETURN NEW;
  END IF;

  v_days_left := (NEW.due_date - CURRENT_DATE);

  -- Só notifica em D-7, D-1 ou já vencido
  IF v_days_left NOT IN (7, 1, 0, -1) THEN
    RETURN NEW;
  END IF;

  IF v_days_left < 0 THEN
    v_title := 'Conta vencida';
    v_msg   := 'A conta "' || COALESCE(NEW.description,'') || '" está vencida. Valor: ' || NEW.currency || ' ' || NEW.amount::text;
  ELSIF v_days_left = 0 THEN
    v_title := 'Conta vence hoje';
    v_msg   := 'Vencimento hoje: "' || COALESCE(NEW.description,'') || '" — ' || NEW.currency || ' ' || NEW.amount::text;
  ELSE
    v_title := 'Conta a vencer em ' || v_days_left || ' dias';
    v_msg   := COALESCE(NEW.description,'') || ' — vence em ' || to_char(NEW.due_date, 'DD/MM/YYYY');
  END IF;

  FOR v_user IN
    SELECT p.user_id
    FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.user_id
    WHERE p.company_id = NEW.company_id
      AND r.role IN ('financeiro','coordenador_financeiro','admin','diretor')
  LOOP
    INSERT INTO public.notifications (company_id, user_id, type, title, message, link)
    VALUES (NEW.company_id, v_user.user_id, 'deadline_warning', v_title, v_msg, '/financial?tab=contas-pagar');
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_payable_due_ins ON public.accounts_payable;
CREATE TRIGGER trg_notify_payable_due_ins
AFTER INSERT ON public.accounts_payable
FOR EACH ROW EXECUTE FUNCTION public.notify_payable_due();

DROP TRIGGER IF EXISTS trg_notify_payable_due_upd ON public.accounts_payable;
CREATE TRIGGER trg_notify_payable_due_upd
AFTER UPDATE OF due_date, status ON public.accounts_payable
FOR EACH ROW
WHEN (OLD.due_date IS DISTINCT FROM NEW.due_date OR OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.notify_payable_due();

-- Função utilitária: varre diariamente e notifica vencidos/vincendos
CREATE OR REPLACE FUNCTION public.scan_payables_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_user record;
  v_days integer;
  v_title text;
  v_msg text;
BEGIN
  FOR r IN
    SELECT * FROM public.accounts_payable
    WHERE status = 'aberto'
      AND due_date <= CURRENT_DATE + INTERVAL '7 days'
  LOOP
    v_days := (r.due_date - CURRENT_DATE);
    IF v_days < 0 THEN
      v_title := 'Conta vencida';
      v_msg := COALESCE(r.description,'') || ' — vencida em ' || to_char(r.due_date,'DD/MM/YYYY');
    ELSIF v_days = 0 THEN
      v_title := 'Conta vence hoje';
      v_msg := COALESCE(r.description,'') || ' — ' || r.currency || ' ' || r.amount::text;
    ELSE
      v_title := 'Conta a vencer em ' || v_days || ' dias';
      v_msg := COALESCE(r.description,'') || ' — vence em ' || to_char(r.due_date,'DD/MM/YYYY');
    END IF;

    FOR v_user IN
      SELECT p.user_id
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.company_id = r.company_id
        AND ur.role IN ('financeiro','coordenador_financeiro','admin','diretor')
    LOOP
      -- Evita duplicidade diária: só insere se não existe notificação hoje para essa conta
      IF NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = v_user.user_id
          AND n.link = '/financial?tab=contas-pagar'
          AND n.title = v_title
          AND n.message = v_msg
          AND n.created_at::date = CURRENT_DATE
      ) THEN
        INSERT INTO public.notifications (company_id, user_id, type, title, message, link)
        VALUES (r.company_id, v_user.user_id, 'deadline_warning', v_title, v_msg, '/financial?tab=contas-pagar');
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
