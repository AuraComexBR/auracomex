
-- Trigger: novo ticket -> notifica todos superadmins
CREATE OR REPLACE FUNCTION public.notify_new_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin record; v_company text;
BEGIN
  SELECT name INTO v_company FROM public.companies WHERE id = NEW.company_id;
  FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'superadmin' LOOP
    INSERT INTO public.notifications (company_id, user_id, type, title, message, link)
    VALUES (NEW.company_id, v_admin.user_id, 'general',
      'Novo ticket de suporte',
      COALESCE(v_company,'') || ': ' || NEW.title,
      '/admin?tab=support');
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_ticket ON public.support_tickets;
CREATE TRIGGER trg_notify_new_ticket
AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_new_ticket();

-- Trigger: mudança de status -> notifica o criador do ticket
CREATE OR REPLACE FUNCTION public.notify_ticket_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (company_id, user_id, type, title, message, link)
    VALUES (NEW.company_id, NEW.created_by, 'status_change',
      'Ticket atualizado',
      NEW.title || ' — novo status: ' || NEW.status,
      '/');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_ticket_status ON public.support_tickets;
CREATE TRIGGER trg_notify_ticket_status
AFTER UPDATE OF status ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_status_change();

-- Trigger: nova mensagem
--  staff respondeu -> notifica o criador do ticket
--  usuário respondeu -> notifica todos superadmins
CREATE OR REPLACE FUNCTION public.notify_ticket_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ticket record; v_admin record;
BEGIN
  SELECT * INTO v_ticket FROM public.support_tickets WHERE id = NEW.ticket_id;
  IF NEW.is_staff THEN
    IF v_ticket.created_by <> NEW.author_id THEN
      INSERT INTO public.notifications (company_id, user_id, type, title, message, link)
      VALUES (v_ticket.company_id, v_ticket.created_by, 'general',
        'Resposta do suporte',
        v_ticket.title || ': nova mensagem do suporte',
        '/');
    END IF;
  ELSE
    FOR v_admin IN SELECT user_id FROM public.user_roles WHERE role = 'superadmin' LOOP
      IF v_admin.user_id <> NEW.author_id THEN
        INSERT INTO public.notifications (company_id, user_id, type, title, message, link)
        VALUES (v_ticket.company_id, v_admin.user_id, 'general',
          'Nova mensagem em ticket',
          v_ticket.title || ': cliente respondeu',
          '/admin?tab=support');
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_ticket_message ON public.support_ticket_messages;
CREATE TRIGGER trg_notify_ticket_message
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_message();
